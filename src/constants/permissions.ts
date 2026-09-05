export const PLATFORM_PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  TENANTS_READ: "tenants:read",
  TENANTS_MANAGE: "tenants:manage",
  PLANS_READ: "plans:read",
  PLANS_MANAGE: "plans:manage",
  SUBSCRIPTIONS_READ: "subscriptions:read",
  SUBSCRIPTIONS_MANAGE: "subscriptions:manage",
  AI_SETTINGS_READ: "ai_settings:read",
  AI_SETTINGS_MANAGE: "ai_settings:manage",
  USAGE_READ: "usage:read",
  WHATSAPP_READ: "whatsapp:read",
  WHATSAPP_MANAGE: "whatsapp:manage",
  MESSAGES_READ: "messages:read",
  BILLING_READ: "billing:read",
  SETTINGS_MANAGE: "settings:manage",
  AUDIT_LOGS_READ: "audit_logs:read",
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];
