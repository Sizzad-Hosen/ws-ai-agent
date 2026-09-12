"use server";

import { redirect } from "next/navigation";

import {
  tenantLoginSchema,
  tenantSlugSchema,
} from "@/features/tenant-dashboard/schemas";
import {
  clientAddress,
  checkLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
} from "@/server/auth/login-throttle";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import {
  setTenantSessionCookie,
  signInTenantUser,
} from "@/server/tenancy/tenant-auth";

export interface TenantLoginResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Signs a tenant user into their own workspace.
 *
 * The slug decides which database the credentials are checked against, and
 * nothing more: a valid email and password for tenant A presented at tenant B
 * finds no user, because the lookup happens in B's database.
 *
 * Throttled per address like the back office, since this is an anonymous,
 * credential-accepting endpoint and every workspace has one.
 */
export async function tenantLoginAction(
  slug: unknown,
  input: unknown,
): Promise<TenantLoginResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsed = tenantLoginSchema.safeParse(input);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const address = await clientAddress();
  const throttle = await checkLoginAllowed(parsed.data.email, address);

  if (!throttle.allowed) {
    return {
      success: false,
      message: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const resolution = await resolveTenant(parsedSlug.data);

  if (!resolution.ok) {
    // Never distinguishes "no such workspace" from "wrong password": both
    // answers would tell someone guessing which workspaces exist.
    await recordFailedLogin(parsed.data.email, address);
    return {
      success: false,
      message: "Those credentials were not recognised.",
    };
  }

  const session = await signInTenantUser(
    resolution.tenant,
    parsed.data.email,
    parsed.data.password,
    parsed.data.rememberMe,
  );

  if (!session) {
    await recordFailedLogin(parsed.data.email, address);
    return {
      success: false,
      message: "Those credentials were not recognised.",
    };
  }

  await clearLoginAttempts(parsed.data.email);
  await setTenantSessionCookie(
    resolution.tenant.slug,
    session.token,
    session.expiresAt,
  );

  redirect(`${tenantBasePath(resolution.tenant.slug)}/dashboard`);
}
