export const PLATFORM_PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  TENANTS_READ: "tenants:read",
  TENANTS_MANAGE: "tenants:manage",
  PLANS_READ: "plans:read",
  PLANS_MANAGE: "plans:manage",
  SUBSCRIPTIONS_READ: "subscriptions:read",
  SUBSCRIPTIONS_MANAGE: "subscriptions:manage",
  BILLING_READ: "billing:read",
  SETTINGS_MANAGE: "settings:manage",
  AUDIT_LOGS_READ: "audit_logs:read",
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];
