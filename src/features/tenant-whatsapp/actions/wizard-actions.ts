"use server";

import { z } from "zod";

import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { env } from "@/config/env";
import { getPhoneNumber, sendTemplate } from "@/lib/whatsapp/graph";
import type { GraphConfig, GraphError } from "@/lib/whatsapp/graph";
import type { MessageKey } from "@/lib/i18n/messages";
import { prisma } from "@/server/db/prisma";
import {
  getTenantContext,
  requirePermission,
} from "@/server/tenancy/tenant-context";
import { TENANT_PERMISSIONS } from "@/server/tenancy/tenant-permissions";

/**
 * What the connect wizard can do from the browser.
 *
 * Every export here is reachable by a direct POST, not only by the screen that
 * renders the button — so every one of them starts with `getTenantContext`,
 * which resolves the tenant, finds the session inside *that tenant's* database
 * and reads the caller's role. The slug in the argument decides which workspace
 * is addressed; it never decides who the caller is.
 *
 * Nothing here returns a sentence. Actions return a `MessageKey`, and the
 * screen translates it, so a shop owner reading Bangla is not handed an English
 * error because it happened to come from a server action rather than a page.
 *
 * Nothing here logs a token, an app secret or a customer's number.
 */

/** The shape every action answers with. */
export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly messageKey: MessageKey;
      readonly vars?: Readonly<Record<string, string | number>>;
    };

function failed(
  messageKey: MessageKey,
  vars?: Readonly<Record<string, string | number>>,
): ActionResult<never> {
  return { ok: false, messageKey, vars };
}

/**
 * Meta's numeric error codes, as sentences a shop owner can act on.
 *
 * The raw object is never shown. "Unsupported get request. Object with ID
 * '123' does not exist" is accurate, and it tells somebody running a shop
 * nothing about which box to re-copy.
 */
function readableGraphError(error: GraphError): MessageKey {
  // Codes arrive as strings: Meta sends a JSON number, and `parseError`
  // stringifies it so a missing code and a zero code stay distinguishable.
  switch (error.code) {
    case "190":
      return "error.token.expired";
    case "100":
      return "error.phoneNumberId.invalid";
    case "200":
    case "10":
      return "error.token.permissions";
    default:
      return "error.generic";
  }
}

/**
 * The Graph settings these calls need.
 *
 * `getPhoneNumber` and `sendTemplate` authenticate with the tenant's own
 * bearer token, so the app id and secret go unused here — they are the
 * platform's, and a tenant connecting their own Meta app has nothing to do
 * with them. Passed anyway because `GraphConfig` is one shape for every call,
 * including `debugToken`, which does need them.
 */
function graphConfig(): GraphConfig {
  return {
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    version: env.META_GRAPH_VERSION,
  };
}

/* ------------------------------------------------------------- step 1 */

const previewSchema = z
  .object({
    slug: tenantSlugSchema,
    query: z.string().trim().min(1).max(120),
  })
  .strict();

export interface PreviewMatch {
  readonly name: string;
  readonly price: string;
  readonly inStock: boolean;
}

/**
 * Answers a question from the tenant's own catalogue.
 *
 * This is the wizard's first screen: a shop owner types what a customer would
 * type and sees their own products come back, before being asked to create
 * anything at Meta.
 *
 * It is a catalogue search, not the agent. There is no model behind it yet —
 * `ai_providers` holds configuration and nothing in this repository calls an
 * LLM. Saying so plainly beats a canned reply that pretends otherwise, and the
 * search is genuinely what the agent will be grounded on.
 */
export async function previewCatalogueAction(
  input: unknown,
): Promise<ActionResult<readonly PreviewMatch[]>> {
  const parsed = previewSchema.safeParse(input);

  if (!parsed.success) return failed("error.generic");

  const { tenant } = await getTenantContext(parsed.data.slug);

  // Every word of three letters or more, so "boi ache?" searches for "boi"
  // and "ache" rather than for the whole sentence, which would match nothing.
  const terms = parsed.data.query
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length >= 3)
    .slice(0, 5);

  if (terms.length === 0) return { ok: true, data: [] };

  const products = await tenant.db.product.findMany({
    where: {
      status: "ACTIVE",
      OR: terms.map((term) => ({
        name: { contains: term, mode: "insensitive" as const },
      })),
    },
    select: {
      name: true,
      basePrice: true,
      variants: {
        select: { inventory: { select: { quantity: true } } },
        take: 1,
      },
    },
    take: 5,
  });

  return {
    ok: true,
    data: products.map((product) => ({
      name: product.name,
      price: product.basePrice.toString(),
      // No inventory row means the product does not track stock, which the
      // catalogue screens already render as available rather than as zero.
      inStock: (product.variants[0]?.inventory?.quantity ?? 1) > 0,
    })),
  };
}

/* ------------------------------------------------------------- step 3 */

const credentialsSchema = z
  .object({
    slug: tenantSlugSchema,
    wabaId: z.string().trim().min(1).max(150),
    phoneNumberId: z.string().trim().min(1).max(150),
    accessToken: z.string().trim().min(1).max(1000),
    /** Only a tenant who created their own Meta app has one. */
    appSecret: z.string().trim().max(200).optional(),
  })
  .strict();

export interface VerifiedNumber {
  readonly displayPhoneNumber: string | null;
  readonly verifiedName: string | null;
  readonly qualityRating: string | null;
  readonly messagingLimit: string | null;
}

/**
 * Checks a pasted token against Meta before anything is written.
 *
 * The order is deliberate and is the order the brief asks for: permission,
 * then shape, then the plan's allowance, then Meta. Asking Meta first would
 * let a tenant at their number limit discover the refusal only after handing
 * over a credential.
 *
 * It writes nothing yet. Persisting needs `setup_step`, `onboarding_method`
 * and `app_secret_encrypted`, whose migration is written but not applied —
 * five stale 20260906 migrations still sort ahead of it. The validation, the
 * error mapping and the plan check are real; the insert lands with stage 4.
 */
export async function validateCredentialsAction(
  input: unknown,
): Promise<ActionResult<VerifiedNumber>> {
  const parsed = credentialsSchema.safeParse(input);

  if (!parsed.success) return failed("error.generic");

  const context = await getTenantContext(parsed.data.slug);

  try {
    requirePermission(context, TENANT_PERMISSIONS.WHATSAPP_CONNECT);
  } catch {
    return failed("error.notAllowed");
  }

  const limit = await readNumberAllowance(context.tenant.id);

  if (limit !== null && limit.used >= limit.max) {
    return failed("error.planLimit", { limit: limit.max });
  }

  const result = await getPhoneNumber(
    graphConfig(),
    parsed.data.phoneNumberId,
    parsed.data.accessToken,
  );

  if (!result.ok) return failed(readableGraphError(result.error));

  return {
    ok: true,
    data: {
      displayPhoneNumber: result.data.displayPhoneNumber,
      verifiedName: result.data.verifiedName,
      qualityRating: result.data.qualityRating,
      messagingLimit: result.data.messagingLimit,
    },
  };
}

/**
 * How many numbers this tenant may connect, and how many are in use.
 *
 * The limit comes from `limits_snapshot` before it comes from the plan. That
 * column exists precisely so that editing a plan never re-limits an existing
 * subscriber — "Limits copied at signup. Editing a plan must never rewrite
 * this" — and reading the live plan here would quietly undo it. The plan is
 * the fallback for a subscription written before the snapshot carried the key.
 *
 * Null when there is no active subscription to read a limit from. A connect
 * attempt is not blocked by a billing record this screen cannot fix.
 */
async function readNumberAllowance(
  tenantId: string,
): Promise<{ readonly max: number; readonly used: number } | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: { in: ["ACTIVE", "TRIALING"] } },
    select: {
      limitsSnapshot: true,
      plan: { select: { maxWhatsappNumbers: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  if (!subscription) return null;

  const snapshot = subscription.limitsSnapshot;
  const snapshotMax =
    typeof snapshot === "object" &&
    snapshot !== null &&
    !Array.isArray(snapshot) &&
    typeof (snapshot as Record<string, unknown>).maxWhatsappNumbers === "number"
      ? ((snapshot as Record<string, unknown>).maxWhatsappNumbers as number)
      : null;

  const used = await prisma.whatsappAccount.count({
    // A disconnected number has been given up and does not spend the allowance.
    where: { tenantId, status: { not: "DISCONNECTED" } },
  });

  return { max: snapshotMax ?? subscription.plan.maxWhatsappNumbers, used };
}

/* ------------------------------------------------------------- step 4 */

const eventCheckSchema = z
  .object({
    slug: tenantSlugSchema,
    phoneNumberId: z.string().trim().min(1).max(150),
  })
  .strict();

/**
 * Has Meta reached us yet for this number?
 *
 * The single most useful thing on the wizard. Subscribing to the `messages`
 * field is the step people miss, and missing it looks exactly like success
 * until a customer complains days later. This turns the screen green the
 * moment the first delivery lands, so nobody has to guess.
 *
 * Reads `webhook_events`, not `whatsapp_accounts.last_webhook_at`: an event
 * that arrived for a number nobody has connected yet is stored unrouted, with
 * no account row to stamp. That unrouted row is exactly the proof wanted here.
 */
export async function checkFirstEventAction(
  input: unknown,
): Promise<ActionResult<{ readonly arrived: boolean }>> {
  const parsed = eventCheckSchema.safeParse(input);

  if (!parsed.success) return failed("error.generic");

  await getTenantContext(parsed.data.slug);

  const event = await prisma.webhookEvent.findFirst({
    where: { phoneNumberId: parsed.data.phoneNumberId, signatureValid: true },
    select: { id: true },
  });

  return { ok: true, data: { arrived: event !== null } };
}

/* ------------------------------------------------------------- step 5 */

const testMessageSchema = z
  .object({
    slug: tenantSlugSchema,
    phoneNumberId: z.string().trim().min(1).max(150),
    accessToken: z.string().trim().min(1).max(1000),
    // Digits only, with the country code. Meta rejects "+" and spaces.
    to: z
      .string()
      .trim()
      .regex(/^\d{8,15}$/),
  })
  .strict();

/**
 * Sends `hello_world` to the tenant's own phone.
 *
 * A template rather than plain text, because the tenant has never messaged
 * their own business number: there is no open 24-hour window, and Meta refuses
 * free-form text outside one. `hello_world` is approved on every WABA from the
 * day it is created.
 */
export async function sendTestMessageAction(
  input: unknown,
): Promise<ActionResult<{ readonly messageId: string | null }>> {
  const parsed = testMessageSchema.safeParse(input);

  if (!parsed.success) return failed("error.generic");

  const context = await getTenantContext(parsed.data.slug);

  try {
    requirePermission(context, TENANT_PERMISSIONS.WHATSAPP_MANAGE);
  } catch {
    return failed("error.notAllowed");
  }

  const result = await sendTemplate(
    graphConfig(),
    parsed.data.phoneNumberId,
    parsed.data.accessToken,
    parsed.data.to,
    "hello_world",
    "en_US",
  );

  if (!result.ok) return failed(readableGraphError(result.error));

  return { ok: true, data: { messageId: result.data.messageId } };
}
