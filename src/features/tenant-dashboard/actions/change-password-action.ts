"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import {
  TENANT_MIN_PASSWORD_LENGTH,
  changeTenantPassword,
} from "@/server/tenancy/tenant-auth";

export interface ChangePasswordResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

const inputSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(
        TENANT_MIN_PASSWORD_LENGTH,
        `Use at least ${TENANT_MIN_PASSWORD_LENGTH} characters.`,
      )
      .max(200),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Both new passwords must match.",
    path: ["confirmPassword"],
  });

/**
 * Replaces the signed-in user's password.
 *
 * Guarded by the same check as every other page, with the one exemption that
 * lets an account owing a change reach this action at all. The current
 * password is re-verified here even though the caller is already signed in: a
 * session left open on a shared machine must not be enough to take the account
 * over.
 */
export async function changePasswordAction(
  slug: unknown,
  input: unknown,
): Promise<ChangePasswordResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant, user } = await requireTenantPage(parsedSlug.data, {
    allowPasswordChange: true,
  });

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const outcome = await changeTenantPassword(
    tenant,
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "same-password"
          ? "Choose a password you have not used here before."
          : "That is not your current password.",
      fieldErrors:
        outcome.reason === "same-password"
          ? { newPassword: ["Choose a different password."] }
          : { currentPassword: ["That is not your current password."] },
    };
  }

  // Every session was revoked, this one included, so the only way on is to
  // sign in again with the new password.
  redirect(`${tenantBasePath(parsedSlug.data)}/login?changed=1`);
}
