"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import {
  assistantSettingsSchema,
  faqListSchema,
  saveAssistantSettings,
  saveFaq,
} from "./settings";

/**
 * The shop owner's control over their own assistant.
 *
 * Separate from `actions.ts` on purpose: that file is the public, unauthenticated
 * chat endpoint, and this one is behind the dashboard guard. Keeping them apart
 * means the guard cannot be forgotten on one of them by editing the other.
 */

export interface AssistantSettingsActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

const payloadSchema = z.object({
  settings: assistantSettingsSchema,
  faq: faqListSchema,
});

export async function saveAssistantAction(
  slug: unknown,
  input: unknown,
): Promise<AssistantSettingsActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = payloadSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: byPath(parsed.error),
    };
  }

  await saveAssistantSettings(tenant.db, parsed.data.settings);
  await saveFaq(tenant.db, parsed.data.faq);

  revalidatePath(tenantHref(parsedSlug.data, "assistant"));
  // The storefront reads these on every render, so it has to be told too.
  revalidatePath(`/${parsedSlug.data}`);

  return { success: true, message: "Assistant settings saved." };
}

/**
 * Errors keyed by dotted path, e.g. `settings.currency` or `faq.2.answer`.
 *
 * `flatten()` only reaches one level down, and everything on this form is
 * nested — a flattened error would tell the owner that "settings" is wrong
 * without saying which field.
 */
function byPath(error: z.ZodError): Record<string, string[] | undefined> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    (errors[key] ??= []).push(issue.message);
  }

  return errors;
}
