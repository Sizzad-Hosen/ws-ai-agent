import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";

/**
 * The shopper's half-finished order, carried in a signed cookie.
 *
 * A storefront visitor is anonymous, so there is no row to hang this off yet —
 * the tenant schema's `customers` and `orders` are for people who have ordered,
 * and writing a row for everyone who says "hi" would fill a shop's database
 * with strangers. The draft therefore lives with the only party who has a
 * reason to keep it: the browser.
 *
 * It is signed, not encrypted. Signing is what matters: the draft names a
 * variant id and a quantity, and an unsigned cookie would let a shopper edit
 * either. It carries nothing secret — every field in it is something the
 * shopper typed about themselves. Prices are never in here at all; they are
 * re-read from the catalogue on every turn and again when the order is
 * written, so a forged cookie cannot buy anything at a price of its choosing.
 *
 * Path-scoped to the tenant, like the dashboard session, so a browser open on
 * two storefronts sends each shop only its own draft.
 */

export const CHECKOUT_STATES = [
  "idle",
  "awaiting_variant",
  "awaiting_quantity",
  "awaiting_name",
  "awaiting_phone",
  "awaiting_address",
  "awaiting_confirmation",
  "order_placed",
] as const;

export type CheckoutState = (typeof CHECKOUT_STATES)[number];

export const draftSchema = z.object({
  /** Stable id for this shopper's chat, used to key their cart. */
  sessionKey: z.string().min(8).max(80),
  state: z.enum(CHECKOUT_STATES).default("idle"),
  language: z
    .enum(["bangla", "banglish", "english", "unknown"])
    .default("unknown"),
  variantId: z.uuid().nullable().default(null),
  /** The search that produced a shortlist, so a reply can be matched to it. */
  pendingQuery: z.string().max(200).nullable().default(null),
  quantity: z.number().int().min(1).max(1000).nullable().default(null),
  customerName: z.string().max(150).nullable().default(null),
  customerPhone: z.string().max(30).nullable().default(null),
  customerAddress: z.string().max(500).nullable().default(null),
  /** Set once the order exists, so a repeated confirmation cannot place two. */
  orderId: z.uuid().nullable().default(null),
  orderNumber: z.string().max(80).nullable().default(null),
});

export type AssistantDraft = z.infer<typeof draftSchema>;

const COOKIE_PREFIX = "sf_chat_";
/** A shopper who walks away mid-order should not come back to a stale draft. */
const MAX_AGE_SECONDS = 60 * 60 * 6;

export function newDraft(): AssistantDraft {
  return draftSchema.parse({ sessionKey: randomUUID() });
}

function cookieName(slug: string): string {
  return `${COOKIE_PREFIX}${slug}`;
}

/**
 * The signing key.
 *
 * Falls back to the database URL in development so a local checkout works with
 * no extra configuration, and refuses to start in production without a real
 * secret — a predictable key is the same as no signature at all.
 */
function signingKey(): string {
  const configured = process.env.STOREFRONT_SESSION_SECRET?.trim();

  if (configured && configured.length >= 16) return configured;

  if (env.NODE_ENV === "production") {
    throw new Error(
      "STOREFRONT_SESSION_SECRET must be set (at least 16 characters) to sign storefront chat drafts.",
    );
  }

  return `development-only:${env.DATABASE_URL}`;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function encode(draft: AssistantDraft): string {
  const payload = Buffer.from(JSON.stringify(draft), "utf8").toString(
    "base64url",
  );

  return `${payload}.${sign(payload)}`;
}

function decode(value: string): AssistantDraft | null {
  const separator = value.lastIndexOf(".");

  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const provided = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(sign(payload));

  // Compared in constant time, and only after the lengths match — `timingSafeEqual`
  // throws rather than returning false when they differ.
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const parsed = draftSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The draft this request carries, or a fresh one. Never throws on bad input. */
export async function readDraft(slug: string): Promise<AssistantDraft> {
  const store = await cookies();
  const raw = store.get(cookieName(slug))?.value;

  return (raw ? decode(raw) : null) ?? newDraft();
}

export async function writeDraft(
  slug: string,
  draft: AssistantDraft,
): Promise<void> {
  const store = await cookies();

  store.set(cookieName(slug), encode(draft), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/${slug}`,
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearDraft(slug: string): Promise<void> {
  const store = await cookies();

  store.delete({ name: cookieName(slug), path: `/${slug}` });
}
