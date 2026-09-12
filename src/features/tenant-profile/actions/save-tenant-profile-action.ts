"use server";

import { revalidatePath } from "next/cache";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { tenantProfileSchema } from "@/features/tenant-profile/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export interface TenantProfileResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Saves the signed-in tenant user's display name.
 *
 * The account written is the session's, never one named in the request. There
 * is no user id parameter for that reason: an action that accepted one would
 * need a check that the caller owns it, and the check that is never written is
 * the one that is never needed.
 */
export async function saveTenantProfileAction(
  slug: unknown,
  input: unknown,
): Promise<TenantProfileResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant, user } = await requireTenantPage(parsedSlug.data);
  const parsed = tenantProfileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await tenant.db.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
    });
  } catch (error: unknown) {
    console.error("Unable to save the tenant profile.", error);
    return {
      success: false,
      message: "Your profile could not be saved. Please try again.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "profile"));

  return { success: true, message: "Profile saved." };
}
