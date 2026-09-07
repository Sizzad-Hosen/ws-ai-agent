import "server-only";

import { z } from "zod";

import { moneySchema } from "@/features/tenant-dashboard/money";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

/**
 * What the shop owner controls about their assistant.
 *
 * Stored in the tenant's own `store_settings`, which is the table the ERD
 * provides for exactly this: per-store configuration that is not part of the
 * catalogue. Keeping it there rather than in the master database means one
 * tenant's greeting, delivery charges and FAQ are physically unreachable from
 * another tenant's connection, like everything else the assistant reads.
 */

export const STOREFRONT_SETTINGS_KEY = "storefront.settings";
export const ASSISTANT_FAQ_KEY = "assistant.faq";

export const assistantSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Shown as the assistant's first message. Empty falls back to a default. */
  greeting: z.string().trim().max(500).default(""),
  greetingBangla: z.string().trim().max(500).default(""),
  /** Free-form house rules the model is told to follow. */
  instructions: z.string().trim().max(2000).default(""),
  /**
   * The currency every price in this shop is quoted in — in the chat and on
   * the owner's own screens, which is why it lives here rather than in code.
   * The tenant schema records a currency per payment, not per store, so this
   * setting is what fills that gap until it does.
   */
  currency: z.string().trim().length(3).toUpperCase().default("BDT"),
  /** The city that counts as local for the delivery charge. */
  homeCity: z.string().trim().max(100).default("Dhaka"),
  deliveryInsideCity: moneySchema.default("80"),
  deliveryOutsideCity: moneySchema.default("150"),
});

export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;

export const faqEntrySchema = z.object({
  question: z.string().trim().min(1, "Enter a question.").max(300),
  answer: z.string().trim().min(1, "Enter an answer.").max(2000),
  /** Optional Bangla answer, used verbatim when the customer writes Bangla. */
  answerBangla: z.string().trim().max(2000).default(""),
});

export type FaqEntry = z.infer<typeof faqEntrySchema>;

export const faqListSchema = z.array(faqEntrySchema).max(100);

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings =
  assistantSettingsSchema.parse({});

export async function loadAssistantSettings(
  db: TenantPrismaClient,
): Promise<AssistantSettings> {
  const row = await db.storeSetting.findUnique({
    where: { settingKey: STOREFRONT_SETTINGS_KEY },
    select: { value: true },
  });

  // A stored value that no longer parses is treated as absent rather than
  // fatal: a storefront should not go dark because a setting drifted.
  const parsed = assistantSettingsSchema.safeParse(row?.value);

  return parsed.success ? parsed.data : DEFAULT_ASSISTANT_SETTINGS;
}

/** Just the currency, for screens that need nothing else from the settings. */
export async function loadStoreCurrency(
  db: TenantPrismaClient,
): Promise<string> {
  return (await loadAssistantSettings(db)).currency;
}

export async function saveAssistantSettings(
  db: TenantPrismaClient,
  settings: AssistantSettings,
): Promise<void> {
  await db.storeSetting.upsert({
    where: { settingKey: STOREFRONT_SETTINGS_KEY },
    create: { settingKey: STOREFRONT_SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
}

export async function loadFaq(
  db: TenantPrismaClient,
): Promise<readonly FaqEntry[]> {
  const row = await db.storeSetting.findUnique({
    where: { settingKey: ASSISTANT_FAQ_KEY },
    select: { value: true },
  });

  const parsed = faqListSchema.safeParse(row?.value);

  return parsed.success ? parsed.data : [];
}

export async function saveFaq(
  db: TenantPrismaClient,
  entries: readonly FaqEntry[],
): Promise<void> {
  await db.storeSetting.upsert({
    where: { settingKey: ASSISTANT_FAQ_KEY },
    create: { settingKey: ASSISTANT_FAQ_KEY, value: [...entries] },
    update: { value: [...entries] },
  });
}
