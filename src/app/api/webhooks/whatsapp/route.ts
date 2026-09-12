import { after } from "next/server";

import { env } from "@/config/env";
import {
  parseWebhookPayload,
  type ParsedWebhookEvent,
} from "@/lib/whatsapp/parse-webhook";
import {
  verifyMetaSignature,
  verifyTokenMatches,
} from "@/lib/whatsapp/signature";
import { prisma } from "@/server/db/prisma";

/**
 * The one webhook URL for the whole platform.
 *
 * As a Meta Tech Provider there is a single Meta app, a single app secret and
 * this single callback. Tenants are not subscribed by registering another
 * webhook — they are subscribed by `POST /{WABA_ID}/subscribed_apps`, and
 * every one of their events then arrives here. Which tenant an event belongs
 * to is decided by `entry[].changes[].value.metadata.phone_number_id`, looked
 * up against the master database.
 *
 * Four rules shape this file, and each of them is a bug if broken:
 *
 *  1. **Always 200.** A non-200 makes Meta retry with backoff and then disable
 *     the subscription for every tenant at once. A bad signature, a malformed
 *     body and an exception are all recorded and answered 200.
 *  2. **Raw body first.** `request.text()` before anything parses, because the
 *     HMAC covers the bytes Meta sent and re-serialising changes them.
 *  3. **Under a second.** No AI, no Graph call, no tenant-database connection.
 *     Resolving a tenant database means a secret lookup and a new pool, which
 *     is not something to do while Meta is holding a socket open.
 *  4. **Idempotent through a constraint.** `skipDuplicates` on the unique
 *     `dedupe_hash`, not a read-then-write, which two concurrent redeliveries
 *     would both pass.
 */

/** Node, not Edge: the signature check needs node:crypto. */
export const runtime = "nodejs";

/** Nothing here may be cached or statically rendered. */
export const dynamic = "force-dynamic";

interface RoutedEvent extends ParsedWebhookEvent {
  readonly tenantId: string | null;
  readonly whatsappAccountId: string | null;
}

/**
 * Structured, and redacting.
 *
 * The payload can contain a customer's message and phone number, and the
 * headers can contain a signature. Neither belongs in a log line, so only ids
 * and counts are recorded.
 */
function log(
  event: string,
  fields: Readonly<Record<string, string | number | boolean | null>>,
): void {
  console.info(JSON.stringify({ at: "whatsapp.webhook", event, ...fields }));
}

/**
 * The handshake Meta performs when the callback URL is saved.
 *
 * Answers `hub.challenge` as plain text when the verify token matches, and 403
 * otherwise. This is the one place a non-200 is right: a wrong token here
 * means somebody else is trying to point their app at this URL.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!env.META_WEBHOOK_VERIFY_TOKEN) {
    log("verify.unconfigured", { mode });
    return new Response("Webhook verification is not configured.", {
      status: 503,
    });
  }

  if (
    mode !== "subscribe" ||
    !verifyTokenMatches(token, env.META_WEBHOOK_VERIFY_TOKEN)
  ) {
    log("verify.rejected", { mode, hasToken: token !== null });
    return new Response("Verification failed.", { status: 403 });
  }

  log("verify.ok", { mode });

  return new Response(challenge ?? "", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<Response> {
  // Rule 2. Before anything else touches the body.
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    log("body.unreadable", {});
    return ok();
  }

  const signature = verifyMetaSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    env.META_APP_SECRET,
  );

  if (!signature.valid) {
    // Recorded rather than refused. A 401 here is what gets a Tech Provider's
    // subscription disabled, and the rejected payload is the evidence.
    log("signature.rejected", {
      reason: signature.reason,
      bytes: rawBody.length,
    });
    after(() => storeUnverified(rawBody, signature.reason));
    return ok();
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    log("payload.malformed", { bytes: rawBody.length });
    return ok();
  }

  const { events, skipped } = parseWebhookPayload(payload);

  if (events.length === 0) {
    log("payload.empty", { skipped });
    return ok();
  }

  try {
    const stored = await persist(events);
    log("stored", {
      received: events.length,
      stored,
      duplicates: events.length - stored,
      skipped,
    });
  } catch (error: unknown) {
    // Rule 1. The answer is still 200: Meta will redeliver, and the unique
    // constraint makes that redelivery safe.
    console.error(
      JSON.stringify({
        at: "whatsapp.webhook",
        event: "store.failed",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
  }

  return ok();
}

function ok(): Response {
  return new Response(null, { status: 200 });
}

/**
 * Routes each event to a tenant and stores it.
 *
 * One query resolves every distinct `phone_number_id` in the delivery, so a
 * batch costs one lookup rather than one per message. An unknown number is
 * stored with a null tenant and left `unrouted` — that is how a number
 * connected to the Meta app but not to any tenant becomes visible, instead of
 * vanishing.
 */
async function persist(events: readonly ParsedWebhookEvent[]): Promise<number> {
  const phoneNumberIds = [...new Set(events.map((e) => e.phoneNumberId))];

  const accounts = await prisma.whatsappAccount.findMany({
    where: { phoneNumberId: { in: phoneNumberIds } },
    select: { id: true, tenantId: true, phoneNumberId: true },
  });

  const byPhoneNumberId = new Map(
    accounts.map((account) => [account.phoneNumberId, account]),
  );

  const routed: RoutedEvent[] = events.map((event) => {
    const account = byPhoneNumberId.get(event.phoneNumberId);

    return {
      ...event,
      tenantId: account?.tenantId ?? null,
      whatsappAccountId: account?.id ?? null,
    };
  });

  // Rule 4. `skipDuplicates` leans on uq_webhook_events_dedupe_hash, so a
  // redelivery inserts nothing rather than being filtered by a prior read.
  const result = await prisma.webhookEvent.createMany({
    data: routed.map((event) => ({
      tenantId: event.tenantId,
      whatsappAccountId: event.whatsappAccountId,
      phoneNumberId: event.phoneNumberId,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload: event.payload as never,
      dedupeHash: event.dedupeHash,
      signatureValid: true,
      status: "UNROUTED" as const,
    })),
    skipDuplicates: true,
  });

  // Liveness, not routing: a number that claims to be live and receives
  // nothing is the failure this column makes visible. Deliberately after the
  // insert, and deliberately not awaited on the request path.
  const known = [
    ...new Set(
      routed.filter((e) => e.whatsappAccountId).map((e) => e.phoneNumberId),
    ),
  ];

  if (known.length > 0) {
    after(async () => {
      await prisma.whatsappAccount
        .updateMany({
          where: { phoneNumberId: { in: known } },
          data: { lastWebhookAt: new Date() },
        })
        .catch(() => undefined);
    });
  }

  return result.count;
}

/**
 * Records a delivery whose signature did not verify.
 *
 * Kept because it is the only evidence that somebody is posting to this URL,
 * and because a genuine delivery failing verification means the app secret is
 * wrong — which looks identical to silence unless it is written down.
 *
 * The body is not parsed for routing: unverified content decides nothing.
 */
async function storeUnverified(rawBody: string, reason: string): Promise<void> {
  const { createHash } = await import("node:crypto");
  const dedupeHash = createHash("sha256")
    .update("unverified " + rawBody, "utf8")
    .digest("hex");

  await prisma.webhookEvent
    .createMany({
      data: [
        {
          eventType: "unverified",
          // Truncated: an unverified body is attacker-controlled and there is
          // no reason to store an unbounded amount of it.
          payload: { raw: rawBody.slice(0, 4000) } as never,
          dedupeHash,
          signatureValid: false,
          status: "FAILED" as const,
          error: `signature ${reason}`,
        },
      ],
      skipDuplicates: true,
    })
    .catch(() => undefined);
}
