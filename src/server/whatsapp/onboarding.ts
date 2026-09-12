import "server-only";

import { env } from "@/config/env";
import {
  createNonce,
  encryptToken,
  readEncryptionKey,
} from "@/lib/whatsapp/crypto";
import {
  debugToken,
  exchangeCodeForToken,
  getPhoneNumber,
  getSubscribedApps,
  registerPhoneNumber,
  subscribeApp,
  type GraphConfig,
  type GraphError,
} from "@/lib/whatsapp/graph";
import { prisma } from "@/server/db/prisma";

/**
 * Connecting one tenant's WhatsApp Business Account.
 *
 * The order of operations is the security design, not a preference:
 *
 *  1. The nonce is minted here and stored. The browser never chooses it.
 *  2. The callback finds the session by nonce. A missing, expired or already
 *     consumed nonce ends the flow — that is what stops a stolen code from
 *     being redeemed against somebody else's tenant.
 *  3. The code is exchanged for a token **server-side**, with the app secret.
 *  4. `debug_token` says which WABAs the token actually grants. The `waba_id`
 *     the popup handed the browser is checked against that list and discarded
 *     if it is not there. Without this step a caller could post any WABA id
 *     and bind another business to their tenant.
 *  5. Only then is anything written to `whatsapp_accounts`.
 *  6. After subscribing, the subscription is **read back**. Meta answering
 *     `{"success":true}` is a claim; the read is the confirmation, and it is
 *     why `verified` exists as a state after `subscribed`.
 */

/** How long a started flow stays redeemable. */
const NONCE_TTL_MS = 15 * 60 * 1000;

export type OnboardingFailure = {
  readonly code: string | null;
  readonly message: string;
};

export type StartResult =
  | {
      readonly ok: true;
      readonly sessionId: string;
      readonly stateNonce: string;
      readonly appId: string;
      readonly configId: string;
    }
  | { readonly ok: false; readonly error: OnboardingFailure };

export type CallbackResult =
  | {
      readonly ok: true;
      readonly sessionId: string;
      readonly accountId: string;
    }
  | {
      readonly ok: false;
      readonly sessionId: string | null;
      readonly error: OnboardingFailure;
    };

function graphConfig(): GraphConfig {
  return {
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    version: env.META_GRAPH_VERSION,
  };
}

function platformReady(): OnboardingFailure | null {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_CONFIG_ID) {
    return {
      code: "platform_unconfigured",
      message:
        "The platform has not finished setting up its Meta app, so connecting is unavailable.",
    };
  }

  return null;
}

function fromGraph(error: GraphError): OnboardingFailure {
  return { code: error.code, message: error.message };
}

/**
 * Opens a flow and returns what the popup needs.
 *
 * The app id and configuration id are public — the Meta SDK needs both in the
 * browser. The app secret is not returned and is never read on this path.
 */
export async function startOnboarding(tenantId: string): Promise<StartResult> {
  const unready = platformReady();
  if (unready) return { ok: false, error: unready };

  // An older unfinished attempt is abandoned rather than left redeemable.
  await prisma.whatsappOnboardingSession.updateMany({
    where: { tenantId, status: "STARTED", consumedAt: null },
    data: { status: "EXPIRED" },
  });

  const session = await prisma.whatsappOnboardingSession.create({
    data: {
      tenantId,
      stateNonce: createNonce(),
      status: "STARTED",
      expiresAt: new Date(Date.now() + NONCE_TTL_MS),
    },
    select: { id: true, stateNonce: true },
  });

  return {
    ok: true,
    sessionId: session.id,
    stateNonce: session.stateNonce,
    appId: env.META_APP_ID,
    configId: env.META_CONFIG_ID,
  };
}

interface CallbackInput {
  readonly tenantId: string;
  readonly stateNonce: string;
  readonly code: string;
  /** As the popup reported them. Both are verified before use. */
  readonly claimedWabaId: string;
  readonly claimedPhoneNumberId: string;
  /** Two-step PIN for registering the number. */
  readonly pin: string;
}

async function fail(
  sessionId: string,
  error: OnboardingFailure,
): Promise<CallbackResult> {
  await prisma.whatsappOnboardingSession
    .update({
      where: { id: sessionId },
      data: {
        status: "FAILED",
        errorCode: error.code,
        errorMessage: error.message,
      },
    })
    .catch(() => undefined);

  return { ok: false, sessionId, error };
}

/** Moves the account through the state machine, so the UI can follow it. */
async function advance(
  accountId: string,
  status:
    | "CONNECTING"
    | "TOKEN_EXCHANGED"
    | "REGISTERED"
    | "SUBSCRIBED"
    | "VERIFIED"
    | "LIVE"
    | "FAILED",
  extra: Record<string, unknown> = {},
): Promise<void> {
  await prisma.whatsappAccount.update({
    where: { id: accountId },
    data: { status, ...extra },
  });
}

export async function completeOnboarding(
  input: CallbackInput,
): Promise<CallbackResult> {
  const unready = platformReady();
  if (unready) return { ok: false, sessionId: null, error: unready };

  let key: Buffer;

  try {
    key = readEncryptionKey(env.WHATSAPP_TOKEN_ENCRYPTION_KEY);
  } catch (error: unknown) {
    return {
      ok: false,
      sessionId: null,
      error: {
        code: "platform_unconfigured",
        message:
          error instanceof Error
            ? error.message
            : "Token encryption is not configured.",
      },
    };
  }

  // ---- 2. the nonce -------------------------------------------------------
  const session = await prisma.whatsappOnboardingSession.findUnique({
    where: { stateNonce: input.stateNonce },
    select: {
      id: true,
      tenantId: true,
      status: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!session) {
    return {
      ok: false,
      sessionId: null,
      error: {
        code: "nonce_unknown",
        message: "That connection attempt is not recognised. Start again.",
      },
    };
  }

  // The session belongs to the tenant that started it. A session id from
  // another workspace is not merely unauthorised, it is not this tenant's.
  if (session.tenantId !== input.tenantId) {
    return {
      ok: false,
      sessionId: null,
      error: {
        code: "nonce_unknown",
        message: "That connection attempt is not recognised. Start again.",
      },
    };
  }

  if (session.consumedAt !== null || session.status !== "STARTED") {
    return fail(session.id, {
      code: "nonce_used",
      message: "That connection attempt was already used. Start again.",
    });
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.whatsappOnboardingSession
      .update({ where: { id: session.id }, data: { status: "EXPIRED" } })
      .catch(() => undefined);

    return {
      ok: false,
      sessionId: session.id,
      error: {
        code: "nonce_expired",
        message: "That connection attempt timed out. Start again.",
      },
    };
  }

  // Spent immediately, so a second callback with the same nonce finds it used
  // even if this one is still running.
  await prisma.whatsappOnboardingSession.update({
    where: { id: session.id },
    data: {
      consumedAt: new Date(),
      wabaId: input.claimedWabaId,
      phoneNumberId: input.claimedPhoneNumberId,
    },
  });

  const config = graphConfig();

  // ---- 3. the code, exchanged server-side ---------------------------------
  const exchanged = await exchangeCodeForToken(config, input.code);

  if (!exchanged.ok) return fail(session.id, fromGraph(exchanged.error));

  // ---- 4. what the token is actually for ----------------------------------
  const debugged = await debugToken(config, exchanged.data.accessToken);

  if (!debugged.ok) return fail(session.id, fromGraph(debugged.error));

  if (!debugged.data.isValid) {
    return fail(session.id, {
      code: "190",
      message: "Meta reported the access token as invalid.",
    });
  }

  // The check the whole flow rests on. The browser said which WABA this is
  // for; Meta says which WABAs the token grants. Disagreement ends it.
  if (!debugged.data.wabaIds.includes(input.claimedWabaId)) {
    return fail(session.id, {
      code: "waba_mismatch",
      message:
        "The WhatsApp Business Account returned by the popup is not one this connection grants access to.",
    });
  }

  const wabaId = input.claimedWabaId;

  const expiresAt =
    debugged.data.expiresAt ??
    (exchanged.data.expiresInSeconds !== null
      ? new Date(Date.now() + exchanged.data.expiresInSeconds * 1000)
      : null);

  // ---- 5. the account row, now that the claim is verified -----------------
  const account = await prisma.whatsappAccount.upsert({
    where: { phoneNumberId: input.claimedPhoneNumberId },
    update: {
      tenantId: session.tenantId,
      wabaId,
      status: "TOKEN_EXCHANGED",
      accessTokenEncrypted: encryptToken(exchanged.data.accessToken, key),
      tokenExpiresAt: expiresAt,
      provider: "meta_cloud",
      lastError: null,
    },
    create: {
      tenantId: session.tenantId,
      phoneNumberId: input.claimedPhoneNumberId,
      wabaId,
      status: "TOKEN_EXCHANGED",
      accessTokenEncrypted: encryptToken(exchanged.data.accessToken, key),
      tokenExpiresAt: expiresAt,
      provider: "meta_cloud",
    },
    select: { id: true },
  });

  await prisma.whatsappOnboardingSession.update({
    where: { id: session.id },
    data: { whatsappAccountId: account.id },
  });

  const token = exchanged.data.accessToken;

  // ---- register the number ------------------------------------------------
  const registered = await registerPhoneNumber(
    config,
    input.claimedPhoneNumberId,
    token,
    input.pin,
  );

  if (!registered.ok) {
    await advance(account.id, "FAILED", {
      lastError: registered.error.code ?? registered.error.message,
    });
    return fail(session.id, fromGraph(registered.error));
  }

  await advance(account.id, "REGISTERED");

  // ---- 6. subscribe, then read it back ------------------------------------
  const subscribed = await subscribeApp(config, wabaId, token);

  if (!subscribed.ok) {
    await advance(account.id, "FAILED", {
      lastError: subscribed.error.code ?? subscribed.error.message,
    });
    return fail(session.id, fromGraph(subscribed.error));
  }

  await advance(account.id, "SUBSCRIBED", { subscribedAt: new Date() });

  const confirmed = await getSubscribedApps(config, wabaId, token);

  if (!confirmed.ok) {
    await advance(account.id, "FAILED", {
      lastError: confirmed.error.code ?? confirmed.error.message,
    });
    return fail(session.id, fromGraph(confirmed.error));
  }

  // Meta said it worked. This is whether it did.
  if (!confirmed.data.some((app) => app.appId === env.META_APP_ID)) {
    await advance(account.id, "FAILED", { lastError: "subscription_absent" });

    return fail(session.id, {
      code: "subscription_absent",
      message:
        "Meta accepted the subscription but does not list it. Messages would not reach us, so the connection was not completed.",
    });
  }

  await advance(account.id, "VERIFIED");

  // ---- metadata, then live ------------------------------------------------
  const number = await getPhoneNumber(
    config,
    input.claimedPhoneNumberId,
    token,
  );

  // A metadata read that fails is not worth failing the connection over: the
  // subscription is confirmed and messages will arrive. The columns stay null
  // and a later sync fills them.
  await advance(account.id, "LIVE", {
    displayPhoneNumber: number.ok ? number.data.displayPhoneNumber : undefined,
    verifiedName: number.ok ? number.data.verifiedName : undefined,
    qualityRating: number.ok ? number.data.qualityRating : undefined,
    messagingLimit: number.ok ? number.data.messagingLimit : undefined,
  });

  await prisma.whatsappOnboardingSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED" },
  });

  return { ok: true, sessionId: session.id, accountId: account.id };
}

export interface OnboardingStatus {
  readonly sessionId: string;
  readonly status: string;
  readonly connectionState: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

/** What the polling endpoint reports. Scoped to the tenant that owns it. */
export async function readOnboardingStatus(
  tenantId: string,
  sessionId: string,
): Promise<OnboardingStatus | null> {
  const session = await prisma.whatsappOnboardingSession.findFirst({
    where: { id: sessionId, tenantId },
    select: {
      id: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      account: { select: { status: true } },
    },
  });

  if (!session) return null;

  return {
    sessionId: session.id,
    status: session.status,
    connectionState: session.account?.status ?? null,
    errorCode: session.errorCode,
    errorMessage: session.errorMessage,
  };
}
