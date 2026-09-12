"use server";

import { redirect } from "next/navigation";

import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import { clearTenantSession } from "@/server/tenancy/tenant-auth";

/**
 * Signs out of one workspace.
 *
 * Deletes the session row as well as the cookie, so a copied token stops
 * working the moment the user signs out rather than at expiry.
 */
export async function tenantLogoutAction(slug: unknown): Promise<void> {
  const parsed = tenantSlugSchema.safeParse(slug);

  if (!parsed.success) redirect("/");

  const resolution = await resolveTenant(parsed.data);

  if (resolution.ok) {
    await clearTenantSession(resolution.tenant);
  }

  redirect(`${tenantBasePath(parsed.data)}/login`);
}
