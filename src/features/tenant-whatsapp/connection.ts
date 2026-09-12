import type { BadgeTone } from "@/components/ui/badge";

/**
 * The tenant-facing view of a WhatsApp connection.
 *
 * The database holds nine states because nine things can fail separately. A
 * tenant does not need nine: they need to know whether it works, whether it is
 * in progress, or what to do about it. This maps one onto the other, and keeps
 * the detail available for the step list while it is connecting.
 */

export const CONNECTION_STATES = [
  "PENDING",
  "CONNECTING",
  "TOKEN_EXCHANGED",
  "REGISTERED",
  "SUBSCRIBED",
  "VERIFIED",
  "LIVE",
  "FAILED",
  "DISCONNECTED",
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];

/** What the screen actually renders: four cases, not nine. */
export type ConnectionView = "not-connected" | "connecting" | "failed" | "live";

export function viewFor(state: ConnectionState | null): ConnectionView {
  if (state === null) return "not-connected";

  switch (state) {
    case "LIVE":
      return "live";
    case "FAILED":
      return "failed";
    case "PENDING":
    case "DISCONNECTED":
      return "not-connected";
    default:
      // CONNECTING, TOKEN_EXCHANGED, REGISTERED, SUBSCRIBED, VERIFIED are all
      // mid-flight. Which one it is drives the step list, not the view.
      return "connecting";
  }
}

/**
 * The steps of the connect flow, in order.
 *
 * Shown while connecting so a tenant can see what has happened and what is
 * outstanding. A spinner that says nothing is the thing this replaces.
 */
export interface ConnectionStep {
  readonly state: ConnectionState;
  readonly label: string;
  readonly detail: string;
}

export const CONNECTION_STEPS: readonly ConnectionStep[] = [
  {
    state: "CONNECTING",
    label: "Signing in with Meta",
    detail: "You approve the connection in the Meta window.",
  },
  {
    state: "TOKEN_EXCHANGED",
    label: "Exchanging the code",
    detail: "We swap the one-time code for an access token.",
  },
  {
    state: "REGISTERED",
    label: "Registering the number",
    detail: "Your number is registered for the Cloud API.",
  },
  {
    state: "SUBSCRIBED",
    label: "Subscribing to your account",
    detail: "We ask Meta to send your messages to us.",
  },
  {
    state: "VERIFIED",
    label: "Confirming the subscription",
    detail: "We read it back from Meta, rather than assuming it worked.",
  },
  {
    state: "LIVE",
    label: "Ready",
    detail: "Messages to your number now reach your workspace.",
  },
];

/** How far along a state is, for ticking off the step list. */
export function stepIndexOf(state: ConnectionState): number {
  const index = CONNECTION_STEPS.findIndex((step) => step.state === state);
  return index;
}

export const CONNECTION_LABELS: Readonly<Record<ConnectionState, string>> = {
  PENDING: "Not connected",
  CONNECTING: "Connecting",
  TOKEN_EXCHANGED: "Connecting",
  REGISTERED: "Connecting",
  SUBSCRIBED: "Connecting",
  VERIFIED: "Connecting",
  LIVE: "Live",
  FAILED: "Connection failed",
  DISCONNECTED: "Disconnected",
};

export const CONNECTION_TONES: Readonly<Record<ConnectionState, BadgeTone>> = {
  PENDING: "neutral",
  CONNECTING: "info",
  TOKEN_EXCHANGED: "info",
  REGISTERED: "info",
  SUBSCRIBED: "info",
  VERIFIED: "info",
  LIVE: "success",
  FAILED: "danger",
  DISCONNECTED: "warning",
};

/**
 * Meta error codes, as sentences a tenant can act on.
 *
 * Meta returns things like `(#100) Invalid parameter` and
 * `(#131047) Re-engagement message`. Showing those to a shop owner is not
 * reporting an error, it is passing the problem along. Each entry here says
 * what happened and what to do about it.
 *
 * Codes are documented at
 * developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes.
 */
const ERROR_SENTENCES: Readonly<Record<string, string>> = {
  "0": "Meta could not authenticate the request. Try connecting again.",
  "3": "This Meta app is not allowed to manage WhatsApp accounts yet. The platform operator needs to complete App Review.",
  "10": "Meta refused the permission needed to manage your WhatsApp account. Make sure you accept every permission in the popup.",
  "100":
    "Meta rejected one of the details sent. Start the connection again, and pick your business and number from the list rather than typing them.",
  "190": "The access token expired before we could finish. Connect again.",
  "200":
    "Your Meta account does not have permission to manage this WhatsApp Business Account. Ask whoever owns it to give you admin access.",
  "368":
    "This WhatsApp Business Account is temporarily blocked by Meta for policy reasons. Meta support can tell you why.",
  "1006":
    "The connection window was closed before it finished. Try again and leave it open.",
  "2388080":
    "This number is already connected to another provider. Disconnect it there first.",
  "131000":
    "Meta had an internal problem. Waiting a minute and trying again usually clears it.",
  "131005":
    "Your business is not verified with Meta yet. Finish business verification in Meta Business Settings, then connect.",
  "131008": "A required detail was missing. Start the connection again.",
  "131016": "Meta's service is temporarily unavailable. Try again shortly.",
  "131042":
    "There is a billing problem on your Meta account. Add a payment method in Meta Business Settings.",
  "131045":
    "Your number is not registered for the Cloud API. Start the connection again so we can register it.",
  "133000":
    "This number is already registered elsewhere. Delete it from the other account first.",
  "133005":
    "The two-step PIN did not match. Reset it in Meta Business Settings and try again.",
  "133010":
    "The number has not been verified with Meta. Verify it in Meta Business Settings first.",
  "133015":
    "The number is in the middle of being moved between accounts. Wait a few minutes and try again.",
};

/** Shown when a code has no sentence of its own. */
const FALLBACK =
  "Something went wrong while connecting, and Meta did not say why. Try again, and tell support the code above if it keeps happening.";

export interface ReadableError {
  readonly sentence: string;
  /** Kept visible so support can act on it. Never the only thing shown. */
  readonly code: string | null;
}

export function readableError(
  code: string | null | undefined,
  message?: string | null,
): ReadableError {
  const trimmed = code?.trim() ?? "";

  if (trimmed && ERROR_SENTENCES[trimmed]) {
    return { sentence: ERROR_SENTENCES[trimmed], code: trimmed };
  }

  // A message with no known code still beats nothing, but it is Meta's wording
  // and is labelled as such on the screen rather than presented as our own.
  return {
    sentence: FALLBACK,
    code: trimmed || (message ? "unknown" : null),
  };
}
