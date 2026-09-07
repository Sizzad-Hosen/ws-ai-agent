"use server";

import { z } from "zod";

import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

import {
  respondToCustomer,
  type AssistantTurn,
  type ProductCard,
} from "./agent";
import { readDraft, writeDraft } from "./session";
import { loadAssistantSettings } from "./settings";

/**
 * The one entry point the storefront chat has.
 *
 * Public by design — a shopper has no account — which makes this the most
 * exposed surface in the application, and it is written accordingly:
 *
 *  - The slug is validated and then *resolved*, so the only database this can
 *    ever touch is the one that slug names. A caller cannot address another
 *    tenant's data by asking differently, because asking differently just
 *    resolves a different, equally-scoped connection.
 *  - Nothing the caller sends is trusted as state. The history is used only as
 *    phrasing context for the model; what the shopper has actually chosen
 *    lives in a signed cookie, and every price is re-read from the database.
 *  - Failures are answered in the shopper's channel rather than thrown. An
 *    unhandled error on a storefront is a broken shop.
 */

const turnSchema = z.object({
  role: z.enum(["customer", "assistant"]),
  text: z.string().max(2000),
});

const requestSchema = z.object({
  slug: tenantSlugSchema,
  message: z.string().trim().min(1).max(1000),
  history: z.array(turnSchema).max(20).default([]),
  /**
   * The product card the shopper tapped, if they tapped one. An id, never a
   * price — the row it names is re-read before anything is quoted from it.
   */
  selectVariantId: z.uuid().nullish().default(null),
});

export interface AssistantActionResult {
  readonly ok: boolean;
  readonly reply: string;
  readonly orderNumber: string | null;
  readonly quickReplies: readonly string[];
  readonly cards: readonly ProductCard[];
}

/**
 * Cheap flood protection.
 *
 * Per-process and therefore approximate — two instances allow twice this —
 * but it is the difference between a bored visitor and a script running up a
 * model bill, and it costs one map lookup. A durable limiter belongs in front
 * of the application, not inside it.
 */
const RATE_LIMIT = { messages: 20, windowMs: 60_000 } as const;

const globalForLimiter = globalThis as unknown as {
  assistantRate?: Map<string, { count: number; resetAt: number }>;
};

const limiter = (globalForLimiter.assistantRate ??= new Map());

function withinRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = limiter.get(key);

  if (!entry || now > entry.resetAt) {
    limiter.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }

  if (entry.count >= RATE_LIMIT.messages) return false;

  entry.count += 1;
  return true;
}

export async function sendAssistantMessageAction(
  input: unknown,
): Promise<AssistantActionResult> {
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      reply: "Sorry, I did not catch that. Could you say it again?",
      orderNumber: null,
      quickReplies: [],
      cards: [],
    };
  }

  const { slug, message, history, selectVariantId } = parsed.data;
  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    return {
      ok: false,
      reply: "This shop is not taking messages right now.",
      orderNumber: null,
      quickReplies: [],
      cards: [],
    };
  }

  const { tenant } = resolution;
  const draft = await readDraft(slug);

  if (!withinRateLimit(`${tenant.id}:${draft.sessionKey}`)) {
    return {
      ok: false,
      reply:
        "You are sending messages faster than I can answer. Please wait a moment.",
      orderNumber: null,
      quickReplies: [],
      cards: [],
    };
  }

  try {
    const settings = await loadAssistantSettings(tenant.db);
    const outcome = await respondToCustomer({
      db: tenant.db,
      businessName: tenant.businessName,
      settings,
      draft,
      message,
      history: history as readonly AssistantTurn[],
      selectVariantId,
    });

    await writeDraft(slug, outcome.draft);

    return {
      ok: true,
      reply: outcome.reply,
      orderNumber: outcome.orderNumber,
      quickReplies: outcome.quickReplies,
      cards: outcome.cards,
    };
  } catch (error: unknown) {
    // Logged with the tenant, never with the message: a shopper's address and
    // phone number are not application logs.
    console.error(
      `Storefront assistant failed for tenant ${tenant.id}.`,
      error,
    );

    return {
      ok: false,
      reply:
        "Something went wrong on our side. Please try again, or contact the shop directly.",
      orderNumber: null,
      quickReplies: [],
      cards: [],
    };
  }
}
