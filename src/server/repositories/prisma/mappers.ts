import {
  AdminStatus as PrismaAdminStatus,
  PlanStatus as PrismaPlanStatus,
  PlatformAdminRole as PrismaPlatformAdminRole,
  ProvisioningStatus as PrismaProvisioningStatus,
  SubscriptionStatus as PrismaSubscriptionStatus,
  TenantStatus as PrismaTenantStatus,
  type PlatformAdmin as PrismaPlatformAdmin,
  type Subscription as PrismaSubscription,
  type SubscriptionPlan as PrismaSubscriptionPlan,
} from "@prisma/client";

import {
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminRole,
} from "@/constants/roles";
import type { PlatformAdmin } from "@/features/auth/types";
import type { SubscriptionPlan } from "@/features/plans/types";
import type { Subscription } from "@/features/subscriptions/types";
import type {
  AdminStatus,
  PlanStatus,
  ProvisioningStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@/types/status";

const adminRoleMap: Record<PrismaPlatformAdminRole, PlatformAdminRole> = {
  [PrismaPlatformAdminRole.SUPER_ADMIN]: PLATFORM_ADMIN_ROLES.SUPER_ADMIN,
  [PrismaPlatformAdminRole.ADMIN]: PLATFORM_ADMIN_ROLES.ADMIN,
  [PrismaPlatformAdminRole.SUPPORT]: PLATFORM_ADMIN_ROLES.SUPPORT,
  [PrismaPlatformAdminRole.FINANCE]: PLATFORM_ADMIN_ROLES.FINANCE,
};

const adminStatusMap: Record<PrismaAdminStatus, AdminStatus> = {
  [PrismaAdminStatus.INVITED]: "invited",
  [PrismaAdminStatus.ACTIVE]: "active",
  [PrismaAdminStatus.SUSPENDED]: "suspended",
};

export const tenantStatusMap: Record<PrismaTenantStatus, TenantStatus> = {
  [PrismaTenantStatus.TRIAL]: "trial",
  [PrismaTenantStatus.ACTIVE]: "active",
  [PrismaTenantStatus.SUSPENDED]: "suspended",
  [PrismaTenantStatus.ARCHIVED]: "archived",
};

const planStatusMap: Record<PrismaPlanStatus, PlanStatus> = {
  [PrismaPlanStatus.ACTIVE]: "active",
  [PrismaPlanStatus.INACTIVE]: "inactive",
  [PrismaPlanStatus.ARCHIVED]: "archived",
};

const subscriptionStatusMap: Record<
  PrismaSubscriptionStatus,
  SubscriptionStatus
> = {
  [PrismaSubscriptionStatus.TRIALING]: "trialing",
  [PrismaSubscriptionStatus.ACTIVE]: "active",
  [PrismaSubscriptionStatus.PAST_DUE]: "past_due",
  [PrismaSubscriptionStatus.CANCELED]: "canceled",
  [PrismaSubscriptionStatus.EXPIRED]: "expired",
};

export const provisioningStatusMap: Record<
  PrismaProvisioningStatus,
  ProvisioningStatus
> = {
  [PrismaProvisioningStatus.PENDING]: "pending",
  [PrismaProvisioningStatus.PROVISIONING]: "provisioning",
  [PrismaProvisioningStatus.READY]: "ready",
  [PrismaProvisioningStatus.FAILED]: "failed",
};

export function mapAdmin(admin: PrismaPlatformAdmin): PlatformAdmin {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: adminRoleMap[admin.role],
    status: adminStatusMap[admin.status],
    lastSignedInAt: admin.lastSignedInAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

export function mapPlan(plan: PrismaSubscriptionPlan): SubscriptionPlan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    status: planStatusMap[plan.status],
    monthlyPriceMinor: plan.monthlyPriceMinor,
    currency: plan.currency,
    limits: {
      monthlyMessages: plan.monthlyMessageLimit,
      adminSeats: plan.adminSeatLimit,
      whatsappNumbers: plan.whatsappNumberLimit,
    },
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function mapSubscription(
  subscription: PrismaSubscription,
): Subscription {
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    planId: subscription.planId,
    status: subscriptionStatusMap[subscription.status],
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}
