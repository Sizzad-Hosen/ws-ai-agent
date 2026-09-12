"use server";

import { revalidatePath } from "next/cache";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { parseSettingsSubmission } from "@/features/tenant-settings/parse-settings";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export interface StoreSettingsResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

/**
 * Saves the workspace settings.
 *
 * Writes go to `store_settings` in the tenant's own database, reached through
 * the guard — there is no tenant id in the payload, so no request can name a
 * workspace it is not signed into.
 *
 * Each key is an upsert on `setting_key`, which is unique, so a save converges
 * rather than accumulating duplicate rows. They run inside one transaction:
 * a half-saved settings screen, where the currency changed but the delivery fee
 * did not, is worse than one that failed cleanly.
 */
export async function saveStoreSettingsAction(
  slug: unknown,
  input: unknown,
): Promise<StoreSettingsResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, message: "That request was not understood." };
  }

  const parsed = parseSettingsSubmission(
    input as Readonly<Record<string, unknown>>,
  );

  if (!parsed.ok) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.errors,
    };
  }

  try {
    await tenant.db.$transaction(
      Object.entries(parsed.values).map(([settingKey, value]) =>
        tenant.db.storeSetting.upsert({
          where: { settingKey },
          update: { value },
          create: { settingKey, value },
        }),
      ),
    );
  } catch (error: unknown) {
    console.error("Unable to save the workspace settings.", error);
    return {
      success: false,
      message: "Your settings could not be saved. Please try again.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "settings"));

  return { success: true, message: "Settings saved." };
}
