export const ADMIN_STATUSES = ["invited", "active", "suspended"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export const TENANT_STATUSES = [
  "trial",
  "active",
  "suspended",
  "archived",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const PLAN_STATUSES = ["active", "inactive", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PROVISIONING_STATUSES = [
  "pending",
  "provisioning",
  "ready",
  "failed",
] as const;
export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];
