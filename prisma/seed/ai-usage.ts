/**
 * AI usage history inside the seeded tenant's own database.
 *
 * The AI usage screen is empty without it, and an empty screen cannot be
 * reviewed — the same reason `seedTenant` exists. Every row goes into the
 * tenant database through `resolveTenant`, never into the master: per-call AI
 * usage is operational tenant data, and the master holds only rollups.
 *
 * `ai_usage_logs.provider_id` and `.model_id` are bare UUIDs pointing at the
 * master `ai_providers` and `ai_models` rows, because Postgres cannot express a
 * cross-database foreign key. They are passed in from `seedAi` so they resolve.
 *
 * Idempotent by guard rather than by upsert: `ai_usage_logs` has no natural
 * unique key to converge on, so a database that already has usage is left
 * exactly as it is.
 */
import type { SeededAiCatalogue } from "./ai";
import { daysAgo } from "./helpers";

import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/** Days of history the seeded usage covers. */
const HISTORY_DAYS = 30;

/** Calls per day. Varied so the chart has a shape rather than a flat line. */
const CALLS_PER_DAY = [4, 7, 3, 9, 6, 11, 5] as const;

const REQUEST_TYPES = [
  "chat_reply",
  "intent_classification",
  "policy_retrieval",
  "product_search",
] as const;

const CONTACTS = [
  { name: "Farhana Akter", phone: "+8801711000101" },
  { name: "Rakib Hasan", phone: "+8801711000102" },
  { name: "Nusrat Jahan", phone: "+8801711000103" },
] as const;

export interface SeededAiUsage {
  readonly logs: number;
  readonly conversations: number;
}

export async function seedAiUsage(
  slug: string,
  catalogue: SeededAiCatalogue,
): Promise<SeededAiUsage> {
  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    console.warn(
      `Skipping AI usage seed: tenant "${slug}" did not resolve (${resolution.reason}).`,
    );
    return { logs: 0, conversations: 0 };
  }

  const db = resolution.tenant.db;

  const existing = await db.aiUsageLog.count();

  if (existing > 0) {
    return { logs: existing, conversations: await db.conversation.count() };
  }

  // A usage row without a conversation is legal — the column is nullable — but
  // it makes the screen unable to say what the spend was *for*, so each run of
  // calls is hung off a real conversation.
  const conversationIds: string[] = [];

  for (const person of CONTACTS) {
    const contact = await db.contact.create({
      data: {
        customerName: person.name,
        phoneNumber: person.phone,
        displayPhoneNumber: person.phone,
        status: "ACTIVE",
        createdAt: daysAgo(HISTORY_DAYS),
      },
      select: { id: true },
    });

    const conversation = await db.conversation.create({
      data: {
        contactId: contact.id,
        status: "OPEN",
        lastMessageAt: daysAgo(1),
        createdAt: daysAgo(HISTORY_DAYS),
      },
      select: { id: true },
    });

    conversationIds.push(conversation.id);

    await db.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          direction: "INBOUND",
          senderType: "CUSTOMER",
          content: "Do you have this in stock?",
          messageType: "TEXT",
          status: "DELIVERED",
          createdAt: daysAgo(2),
        },
        {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          senderType: "AI",
          content: "Yes, it is in stock. Would you like to order it?",
          messageType: "TEXT",
          status: "READ",
          createdAt: daysAgo(2),
        },
      ],
    });
  }

  const rows = buildUsageRows(conversationIds, catalogue);

  await db.aiUsageLog.createMany({ data: rows });

  return { logs: rows.length, conversations: conversationIds.length };
}

interface UsageRow {
  readonly conversationId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly requestType: string;
  readonly inputTokens: bigint;
  readonly outputTokens: bigint;
  readonly totalTokens: bigint;
  readonly estimatedCost: string;
  readonly status: "SUCCESS" | "ERROR" | "THROTTLED";
  readonly createdAt: Date;
}

/**
 * Deterministic, so two seeds of the same empty database produce the same
 * history. `Math.random` would make every reviewer see different numbers and
 * make a screenshot impossible to compare against.
 */
function buildUsageRows(
  conversationIds: readonly string[],
  catalogue: SeededAiCatalogue,
): UsageRow[] {
  const rows: UsageRow[] = [];
  let counter = 0;

  for (let dayOffset = HISTORY_DAYS; dayOffset >= 0; dayOffset -= 1) {
    const calls = CALLS_PER_DAY[dayOffset % CALLS_PER_DAY.length] ?? 5;

    for (let call = 0; call < calls; call += 1) {
      counter += 1;

      const requestType =
        REQUEST_TYPES[counter % REQUEST_TYPES.length] ?? "chat_reply";
      const embedding = requestType === "policy_retrieval";

      const inputTokens = BigInt(320 + ((counter * 37) % 900));
      const outputTokens = embedding
        ? BigInt(0)
        : BigInt(90 + ((counter * 19) % 400));

      // One call in seventeen fails, and one in twenty-three is throttled, so
      // the error rate on the screen is a real figure and not always zero.
      const status: UsageRow["status"] =
        counter % 17 === 0
          ? "ERROR"
          : counter % 23 === 0
            ? "THROTTLED"
            : "SUCCESS";

      const createdAt = daysAgo(dayOffset);
      createdAt.setHours(8 + (call % 12), (counter * 7) % 60, 0, 0);

      rows.push({
        conversationId:
          conversationIds[counter % conversationIds.length] ??
          conversationIds[0]!,
        providerId: catalogue.providerId,
        modelId: embedding
          ? catalogue.embeddingModelId
          : catalogue.chatModelId,
        requestType,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: estimateCost(inputTokens, outputTokens, embedding),
        status,
        createdAt,
      });
    }
  }

  return rows;
}

/**
 * Cost from the same per-million-token rates `seedAi` writes to `ai_models`,
 * so the seeded spend matches the seeded rate card instead of being a made-up
 * number that contradicts it.
 */
function estimateCost(
  inputTokens: bigint,
  outputTokens: bigint,
  embedding: boolean,
): string {
  const inputRate = embedding ? 0.02 : 2.5;
  const outputRate = embedding ? 0 : 10;

  const cost =
    (Number(inputTokens) / 1_000_000) * inputRate +
    (Number(outputTokens) / 1_000_000) * outputRate;

  // `ai_usage_logs.estimated_cost` is Decimal(12,6).
  return cost.toFixed(6);
}
