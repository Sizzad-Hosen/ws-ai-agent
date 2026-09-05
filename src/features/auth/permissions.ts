import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from "@/constants/permissions";
import {
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminRole,
} from "@/constants/roles";

const allPermissions = Object.values(PLATFORM_PERMISSIONS);

/**
 * Interim role→permission map.
 *
 * The ERD models authorization twice (`admin_users.role` enum *and* the
 * `admin_roles`/`permissions`/`admin_role_permissions` triple, with no FK
 * joining them). Until D-01 in docs/IMPLEMENTATION_PLAN.md is decided this map
 * stays the single source, and every call site goes through `can()` so the
 * switch to database-backed RBAC touches only this file.
 */
export const ROLE_PERMISSIONS: Readonly<
  Record<PlatformAdminRole, readonly PlatformPermission[]>
> = {
  [PLATFORM_ADMIN_ROLES.SUPER_ADMIN]: allPermissions,
  [PLATFORM_ADMIN_ROLES.ADMIN]: allPermissions.filter(
    (permission) => permission !== PLATFORM_PERMISSIONS.BILLING_READ,
  ),
  [PLATFORM_ADMIN_ROLES.SUPPORT]: [
    PLATFORM_PERMISSIONS.DASHBOARD_READ,
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ,
    PLATFORM_PERMISSIONS.PLANS_READ,
    PLATFORM_PERMISSIONS.WHATSAPP_READ,
    PLATFORM_PERMISSIONS.MESSAGES_READ,
    PLATFORM_PERMISSIONS.AUDIT_LOGS_READ,
  ],
  [PLATFORM_ADMIN_ROLES.FINANCE]: [
    PLATFORM_PERMISSIONS.DASHBOARD_READ,
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.PLANS_READ,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_MANAGE,
    PLATFORM_PERMISSIONS.USAGE_READ,
    PLATFORM_PERMISSIONS.BILLING_READ,
  ],
};

export function can(
  role: PlatformAdminRole,
  permission: PlatformPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
