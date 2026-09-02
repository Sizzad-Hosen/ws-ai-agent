export const PLATFORM_ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SUPPORT: "support",
  FINANCE: "finance",
} as const;

export type PlatformAdminRole =
  (typeof PLATFORM_ADMIN_ROLES)[keyof typeof PLATFORM_ADMIN_ROLES];
