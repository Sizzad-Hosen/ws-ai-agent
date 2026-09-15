import "server-only";

import type { TenantUserRole } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import {
  requireTenantPage,
  type TenantContext,
} from "@/server/tenancy/tenant-guard";
import {
  FALLBACK_TENANT_ROLE,
  roleHasPermission,
  type TenantPermission,
} from "@/server/tenancy/tenant-permissions";

/**
 * `requireTenantPage` plus the caller's role.
 *
 * The role is not in the workspace session, and cannot be: the tenant database
 * `users` table has no role column — the master `tenant_users` table does, and
 * its comment says why ("The diagram draws roles varchar(20). Renamed and made
 * an enum, because the RBAC tables are out of MVP"). So this reads it from the
 * master database on `(tenant_id, email)`, which is a unique key.
 *
 * That is one extra query per guarded page. It is not cached: a role change
 * that takes effect on the next navigation is the behaviour to want, and the
 * row is small and indexed.
 *
 * Note what is *not* here. There is no "does this user belong to this tenant"
 * comparison, because the session was already looked up inside that tenant's
 * own database — a user of tenant A presenting their cookie to tenant B
 * resolves to nobody. The role lookup narrows what a legitimate member may do;
 * it is not what keeps tenants apart.
 */

export interface TenantContextWithRole extends TenantContext {
  readonly role: TenantUserRole;
}

export class TenantPermissionError extends Error {
  readonly permission: TenantPermission;
  readonly role: TenantUserRole;

  constructor(permission: TenantPermission, role: TenantUserRole) {
    super(`Role ${role} does not hold ${permission}.`);
    this.name = "TenantPermissionError";
    this.permission = permission;
    this.role = role;
  }
}

/**
 * Reads a member's role from the master database.
 *
 * Falls back rather than throwing when the row is absent. See
 * `FALLBACK_TENANT_ROLE` for why that is VIEWER and not a refusal.
 */
export async function readTenantRole(
  tenantId: string,
  email: string,
): Promise<TenantUserRole> {
  try {
    const member = await prisma.tenantUser.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { role: true, deletedAt: true },
    });

    if (!member || member.deletedAt !== null) return FALLBACK_TENANT_ROLE;

    return member.role;
  } catch (error: unknown) {
    // A master database that cannot be read is not a reason to grant more than
    // the fallback. Logged without the email, which is personal data.
    console.error(
      JSON.stringify({
        at: "tenancy.role",
        event: "lookup.failed",
        tenantId,
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );

    return FALLBACK_TENANT_ROLE;
  }
}

/**
 * The guard a tenant page or server action starts with.
 *
 * Everything `requireTenantPage` does — unknown slug is a 404, no session
 * redirects to the workspace login, an unchanged password redirects to the
 * change screen — and then the role.
 */
export async function getTenantContext(
  slug: string,
  options: { readonly allowPasswordChange?: boolean } = {},
): Promise<TenantContextWithRole> {
  const context = await requireTenantPage(slug, options);
  const role = await readTenantRole(context.tenant.id, context.user.email);

  return { ...context, role };
}

/** True when the caller may do this. Use it to hide a control. */
export function hasPermission(
  context: TenantContextWithRole,
  permission: TenantPermission,
): boolean {
  return roleHasPermission(context.role, permission);
}

/**
 * Throws unless the caller holds the permission. Use it to refuse the write.
 *
 * Deliberately a throw and not a redirect: a server action that redirects on
 * refusal reports success to the client that called it.
 */
export function requirePermission(
  context: TenantContextWithRole,
  permission: TenantPermission,
): void {
  if (!roleHasPermission(context.role, permission)) {
    throw new TenantPermissionError(permission, context.role);
  }
}
