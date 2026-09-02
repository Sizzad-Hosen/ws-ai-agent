import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from "@/constants/permissions";
import {
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminRole,
} from "@/constants/roles";

const allPermissions = Object.values(PLATFORM_PERMISSIONS);

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
    PLATFORM_PERMISSIONS.AUDIT_LOGS_READ,
  ],
  [PLATFORM_ADMIN_ROLES.FINANCE]: [
    PLATFORM_PERMISSIONS.DASHBOARD_READ,
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.PLANS_READ,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_MANAGE,
    PLATFORM_PERMISSIONS.BILLING_READ,
  ],
};

export function can(
  role: PlatformAdminRole,
  permission: PlatformPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
