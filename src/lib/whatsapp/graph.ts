/**
 * The Meta Graph API calls this platform makes as a Tech Provider.
 *
 * Every function returns a result rather than throwing, because every one of
 * them can fail in a way a tenant needs explaining: a token that expired, a
 * business that is not verified, a number already registered somewhere else.
 * A thrown provider string reaches a shop owner as gibberish, so the failure
 * carries Meta's error code and the caller maps it to a sentence.
 *
 * Nothing here logs a token or a secret. `redactGraphUrl` exists because the
 * access token travels in the query string on some endpoints, and a URL logged
 * verbatim is a leaked credential.
 */

export interface GraphConfig {
  readonly appId: string;
  readonly appSecret: string;
  readonly version: string;
}

export interface GraphError {
  /** Meta's numeric code, as a string. The key the UI maps to a sentence. */
  readonly code: string | null;
  readonly subcode: string | null;
  /** Meta's own wording. For support and logs, never for a tenant to read. */
  readonly message: string;
  readonly httpStatus: number | null;
}

export type GraphResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: GraphError };

const GRAPH_ORIGIN = "https://graph.facebook.com";

/** Meta is slow sometimes; a hung connect flow is worse than a failed one. */
const TIMEOUT_MS = 15_000;

function failure(
  message: string,
  code: string | null = null,
  httpStatus: number | null = null,
): GraphError {
  return { code, subcode: null, message, httpStatus };
}

/** Strips anything credential-shaped from a URL before it reaches a log. */
export function redactGraphUrl(url: string): string {
  try {
    const parsed = new URL(url);

    for (const key of [
      "access_token",
      "client_secret",
      "input_token",
      "code",
    ]) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "REDACTED");
      }
    }

    return parsed.toString();
  } catch {
    return "invalid-url";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Pulls Meta's error envelope out of a response body. */
function parseError(body: unknown, httpStatus: number): GraphError {
  if (isRecord(body) && isRecord(body.error)) {
    const error = body.error;

    return {
      code: error.code === undefined ? null : String(error.code),
      subcode:
        error.error_subcode === undefined ? null : String(error.error_subcode),
      message:
        typeof error.message === "string"
          ? error.message
          : "Meta returned an error with no message.",
      httpStatus,
    };
  }

  return failure(`Meta returned HTTP ${httpStatus}.`, null, httpStatus);
}

async function call<T>(
  url: string,
  init: RequestInit,
): Promise<GraphResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    const aborted = error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      error: failure(
        aborted
          ? `Meta did not answer within ${TIMEOUT_MS / 1000} seconds.`
          : "Could not reach Meta.",
      ),
    };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return { ok: false, error: parseError(body, response.status) };
  }

  return { ok: true, data: body as T };
}

function endpoint(config: GraphConfig, path: string): string {
  return `${GRAPH_ORIGIN}/${config.version}/${path}`;
}

function authorised(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

// ------------------------------------------------------------------ tokens

export interface ExchangedToken {
  readonly accessToken: string;
  /** Seconds until expiry, when Meta says. A system user token may not expire. */
  readonly expiresInSeconds: number | null;
}

/**
 * Swaps the one-time code the Embedded Signup popup returns for a token.
 *
 * The app secret is sent here and must never be anywhere the browser can see.
 * The code is single use: a replay fails at Meta, which is a second line of
 * defence behind the nonce.
 */
export async function exchangeCodeForToken(
  config: GraphConfig,
  code: string,
): Promise<GraphResult<ExchangedToken>> {
  const url = new URL(endpoint(config, "oauth/access_token"));
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("code", code);

  const result = await call<{
    access_token?: unknown;
    expires_in?: unknown;
  }>(url.toString(), { method: "GET" });

  if (!result.ok) return result;

  const accessToken = result.data.access_token;

  if (typeof accessToken !== "string" || accessToken === "") {
    return {
      ok: false,
      error: failure("Meta returned no access token for that code."),
    };
  }

  return {
    ok: true,
    data: {
      accessToken,
      expiresInSeconds:
        typeof result.data.expires_in === "number"
          ? result.data.expires_in
          : null,
    },
  };
}

export interface DebuggedToken {
  readonly appId: string;
  readonly isValid: boolean;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
  /** The WABA ids this token actually grants, from granular_scopes. */
  readonly wabaIds: readonly string[];
}

/**
 * Asks Meta what a token is really for.
 *
 * This is the check that makes the callback safe. The popup hands the browser a
 * `waba_id`, and the browser is not trustworthy — a caller could post any id
 * and, without this, the platform would happily bind another business's account
 * to their tenant. `granular_scopes` says which WABAs the token was actually
 * issued for, and the callback refuses anything not in that list.
 */
export async function debugToken(
  config: GraphConfig,
  token: string,
): Promise<GraphResult<DebuggedToken>> {
  const url = new URL(endpoint(config, "debug_token"));
  url.searchParams.set("input_token", token);
  // App access token form: the app proving its own identity.
  url.searchParams.set("access_token", `${config.appId}|${config.appSecret}`);

  const result = await call<{ data?: unknown }>(url.toString(), {
    method: "GET",
  });

  if (!result.ok) return result;

  const data = isRecord(result.data.data) ? result.data.data : null;

  if (!data) {
    return { ok: false, error: failure("Meta returned no token details.") };
  }

  const wabaIds: string[] = [];

  for (const scope of Array.isArray(data.granular_scopes)
    ? data.granular_scopes
    : []) {
    if (!isRecord(scope)) continue;
    if (scope.scope !== "whatsapp_business_management") continue;

    for (const id of Array.isArray(scope.target_ids) ? scope.target_ids : []) {
      if (typeof id === "string") wabaIds.push(id);
    }
  }

  return {
    ok: true,
    data: {
      appId: typeof data.app_id === "string" ? data.app_id : "",
      isValid: data.is_valid === true,
      expiresAt:
        typeof data.expires_at === "number" && data.expires_at > 0
          ? new Date(data.expires_at * 1000)
          : null,
      scopes: Array.isArray(data.scopes)
        ? data.scopes.filter((s): s is string => typeof s === "string")
        : [],
      wabaIds,
    },
  };
}

// ------------------------------------------------------------------ numbers

export interface PhoneNumber {
  readonly id: string;
  readonly displayPhoneNumber: string | null;
  readonly verifiedName: string | null;
  readonly qualityRating: string | null;
  readonly messagingLimit: string | null;
  readonly codeVerificationStatus: string | null;
}

export async function getPhoneNumber(
  config: GraphConfig,
  phoneNumberId: string,
  token: string,
): Promise<GraphResult<PhoneNumber>> {
  const url = new URL(endpoint(config, phoneNumberId));
  url.searchParams.set(
    "fields",
    "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status",
  );

  const result = await call<Record<string, unknown>>(url.toString(), {
    method: "GET",
    headers: authorised(token),
  });

  if (!result.ok) return result;

  const data = result.data;
  const text = (key: string): string | null =>
    typeof data[key] === "string" ? (data[key] as string) : null;

  return {
    ok: true,
    data: {
      id: text("id") ?? phoneNumberId,
      displayPhoneNumber: text("display_phone_number"),
      verifiedName: text("verified_name"),
      qualityRating: text("quality_rating"),
      messagingLimit: text("messaging_limit_tier"),
      codeVerificationStatus: text("code_verification_status"),
    },
  };
}

/**
 * Registers a number for the Cloud API.
 *
 * Required before the number can send or receive through the Cloud API at all.
 * The PIN is the two-step verification PIN; a number that already has one set
 * elsewhere will refuse with 133005, which the UI explains.
 */
export async function registerPhoneNumber(
  config: GraphConfig,
  phoneNumberId: string,
  token: string,
  pin: string,
): Promise<GraphResult<{ success: boolean }>> {
  const result = await call<{ success?: unknown }>(
    endpoint(config, `${phoneNumberId}/register`),
    {
      method: "POST",
      headers: authorised(token),
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    },
  );

  if (!result.ok) return result;

  return { ok: true, data: { success: result.data.success === true } };
}

// ------------------------------------------------------------ subscriptions

/**
 * Subscribes this app to a tenant's WhatsApp Business Account.
 *
 * This is the whole of per-tenant connection as a Tech Provider. There is no
 * second webhook to register: this platform has one callback URL, and this call
 * is what starts sending a particular tenant's events to it.
 */
export async function subscribeApp(
  config: GraphConfig,
  wabaId: string,
  token: string,
): Promise<GraphResult<{ success: boolean }>> {
  const result = await call<{ success?: unknown }>(
    endpoint(config, `${wabaId}/subscribed_apps`),
    { method: "POST", headers: authorised(token) },
  );

  if (!result.ok) return result;

  return { ok: true, data: { success: result.data.success === true } };
}

export interface SubscribedApp {
  readonly appId: string;
  readonly name: string | null;
}

/**
 * Reads back which apps a WABA is subscribed to.
 *
 * The connect flow calls this after subscribing, and treats a missing entry as
 * a failure. Meta answering `{"success":true}` is a claim; this is the
 * confirmation, and the difference is the whole reason the state machine has a
 * `verified` step after `subscribed`.
 */
export async function getSubscribedApps(
  config: GraphConfig,
  wabaId: string,
  token: string,
): Promise<GraphResult<readonly SubscribedApp[]>> {
  const result = await call<{ data?: unknown }>(
    endpoint(config, `${wabaId}/subscribed_apps`),
    { method: "GET", headers: authorised(token) },
  );

  if (!result.ok) return result;

  const rows = Array.isArray(result.data.data) ? result.data.data : [];
  const apps: SubscribedApp[] = [];

  for (const row of rows) {
    if (!isRecord(row)) continue;

    const app = isRecord(row.whatsapp_business_api_data)
      ? row.whatsapp_business_api_data
      : row;

    const id = app.id;
    if (typeof id === "string") {
      apps.push({
        appId: id,
        name: typeof app.name === "string" ? app.name : null,
      });
    }
  }

  return { ok: true, data: apps };
}

// ------------------------------------------------------------------ sending

export async function sendText(
  config: GraphConfig,
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
): Promise<GraphResult<{ messageId: string | null }>> {
  const result = await call<{ messages?: unknown }>(
    endpoint(config, `${phoneNumberId}/messages`),
    {
      method: "POST",
      headers: authorised(token),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        // 4096 is the Cloud API limit; a longer body is rejected outright.
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    },
  );

  if (!result.ok) return result;

  const messages = Array.isArray(result.data.messages)
    ? result.data.messages
    : [];
  const first = messages[0];

  return {
    ok: true,
    data: {
      messageId:
        isRecord(first) && typeof first.id === "string" ? first.id : null,
    },
  };
}
