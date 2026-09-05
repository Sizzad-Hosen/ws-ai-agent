"use server";

import { revalidatePath } from "next/cache";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { siteSettingsFormSchema } from "@/features/system/site-settings";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface SiteSettingsActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Saves the public site settings.
 *
 * Note: this action is not audited. `platform_audit_logs` is not in the ERD
 * (§2.3), so a change to the public support address leaves no record.
 */
export async function saveSiteSettingsAction(
  input: unknown,
): Promise<SiteSettingsActionResult> {
  await requirePermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);

  const parsed = siteSettingsFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      // Nested paths are flattened to dotted keys so the form can map them
      // back onto its own field names.
      fieldErrors: parsed.error.issues.reduce<Record<string, string[]>>(
        (accumulator, issue) => {
          const key = issue.path.join(".");
          accumulator[key] = [...(accumulator[key] ?? []), issue.message];
          return accumulator;
        },
        {},
      ),
    };
  }

  try {
    await repositories.siteSettings.save(parsed.data);
  } catch (error: unknown) {
    console.error("Unable to save the site settings.", error);
    return {
      success: false,
      message: "That change could not be saved. Please try again.",
    };
  }

  revalidatePath(ROUTES.bo.system);
  revalidatePath(ROUTES.home);

  return { success: true, message: "Settings saved." };
}
