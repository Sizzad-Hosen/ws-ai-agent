"use server";

import { revalidatePath } from "next/cache";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { siteSettingsFormSchema } from "@/features/system/site-settings";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface SiteSettingsActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Saves the public site settings.
 */
export async function saveSiteSettingsAction(
  input: unknown,
): Promise<SiteSettingsActionResult> {
  const actor = await requirePermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);

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
    await repositories.siteSettings.save(parsed.data, actor.id);
  } catch (error: unknown) {
    console.error("Unable to save the site settings.", error);
    return {
      success: false,
      message: "That change could not be saved. Please try again.",
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.SITE_SETTINGS_UPDATE,
    entityType: "settings",
    entityId: "site_settings",
    metadata: {
      brandName: parsed.data.brand.name,
      supportEmail: parsed.data.contact.supportEmail,
      announcementEnabled: parsed.data.announcement.enabled,
    },
  });

  revalidatePath(ROUTES.bo.system);
  revalidatePath(ROUTES.home);

  return { success: true, message: "Settings saved." };
}
