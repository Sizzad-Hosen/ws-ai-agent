"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { profileDetailsSchema } from "@/features/profile/schemas";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requireBoAdmin } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface ProfileActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Updates the signed-in administrator's own name and email.
 *
 * The row updated is the one the session names. No id is accepted from the
 * caller: this is a self-service form, so "which account" is never a question
 * the request gets to answer.
 *
 * `requireBoAdmin` rather than `requirePermission`: editing your own name is
 * not a privileged action, and gating it behind a permission would lock the
 * lowest role out of their own profile. The schema is `.strict()`, so a
 * request that smuggles `role` or `status` alongside is rejected rather than
 * silently ignored.
 */
export async function saveProfileAction(
  input: unknown,
): Promise<ProfileActionResult> {
  const admin = await requireBoAdmin();
  const parsed = profileDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;
  let outcome;

  try {
    outcome = await repositories.admins.updateProfile(admin.id, values);
  } catch (error: unknown) {
    console.error("Unable to save the profile.", error);
    return {
      success: false,
      message: "That change could not be saved. Please try again.",
    };
  }

  if (!outcome.ok) {
    return {
      success: false,
      message: "That email address is already in use.",
      fieldErrors: { email: ["Another administrator uses this address."] },
    };
  }

  await recordAudit({
    actor: admin,
    action: AUDIT_ACTIONS.PROFILE_UPDATE,
    entityType: "admin",
    entityId: admin.id,
    // The old values matter here: a changed sign-in address is the sort of
    // thing an investigation needs to be able to walk backwards.
    metadata: {
      from: { name: admin.name, email: admin.email },
      to: { name: values.name, email: values.email },
    },
  });

  // The header reads the name and avatar from the session's admin row.
  revalidatePath(ROUTES.bo.profile);
  revalidatePath(ROUTES.bo.root, "layout");

  return { success: true, message: "Profile updated." };
}
