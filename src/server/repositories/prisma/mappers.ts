import {
  AdminRole as PrismaAdminRole,
  AdminStatus as PrismaAdminStatus,
  AiProviderStatus as PrismaAiProviderStatus,
  BillingCycle as PrismaBillingCycle,
  InvoiceStatus as PrismaInvoiceStatus,
  RegistrationCheckStatus as PrismaCheckStatus,
  RegistrationCheckType as PrismaCheckType,
  RegistrationStatus as PrismaRegistrationStatus,
  SubscriptionStatus as PrismaSubscriptionStatus,
  TenantApprovalStatus as PrismaTenantApprovalStatus,
  TenantStatus as PrismaTenantStatus,
  TenantDatabaseStatus as PrismaTenantDatabaseStatus,
  type AdminUser as PrismaAdminUser,
  type AiModel as PrismaAiModel,
  type AiProvider as PrismaAiProvider,
  type Invoice as PrismaInvoice,
  type Plan as PrismaPlan,
  type Subscription as PrismaSubscription,
  type Tenant as PrismaTenant,
  type TenantDatabase as PrismaTenantDatabase,
  type TenantRegistration as PrismaTenantRegistration,
  type TenantRegistrationCheck as PrismaTenantRegistrationCheck,
} from "@prisma/client";

import {
  PLATFORM_ADMIN_ROLES,
  type PlatformAdminRole,
} from "@/constants/roles";
import { env } from "@/config/env";
import type { AiModel, AiProvider } from "@/features/ai-settings/types";
import type { PlatformAdmin } from "@/features/auth/types";
import { buildWebsiteUrl } from "@/features/registrations/provisioning";
import {
  EMPTY_PLAN_FEATURES,
  type Plan,
  type PlanFeatures,
} from "@/features/plans/types";
import type {
  RegistrationCheck,
  TenantRegistration,
} from "@/features/registrations/types";
import type { Invoice, Subscription } from "@/features/subscriptions/types";
import type { Tenant, TenantDatabase } from "@/features/tenants/types";
import type {
  AdminStatus,
  AiProviderStatus,
  BillingCycle,
  InvoiceStatus,
  ProvisioningStatus,
  RegistrationCheckStatus,
  RegistrationCheckType,
  RegistrationStatus,
  SubscriptionStatus,
  TenantApprovalStatus,
  TenantStatus,
} from "@/types/status";

/*
 * Prisma enum members are SCREAMING_SNAKE; the domain uses lower snake. These
 * maps are exhaustive by construction — adding an enum member to the schema
 * fails the build here until it is handled.
 */

const adminRoleMap: Record<PrismaAdminRole, PlatformAdminRole> = {
  [PrismaAdminRole.SUPER_ADMIN]: PLATFORM_ADMIN_ROLES.SUPER_ADMIN,
  [PrismaAdminRole.ADMIN]: PLATFORM_ADMIN_ROLES.ADMIN,
  [PrismaAdminRole.SUPPORT]: PLATFORM_ADMIN_ROLES.SUPPORT,
  [PrismaAdminRole.FINANCE]: PLATFORM_ADMIN_ROLES.FINANCE,
};

const adminStatusMap: Record<PrismaAdminStatus, AdminStatus> = {
  [PrismaAdminStatus.INVITED]: "invited",
  [PrismaAdminStatus.ACTIVE]: "active",
  [PrismaAdminStatus.SUSPENDED]: "suspended",
};

export const tenantApprovalMap: Record<
  PrismaTenantApprovalStatus,
  TenantApprovalStatus
> = {
  [PrismaTenantApprovalStatus.PENDING_REVIEW]: "pending_review",
  [PrismaTenantApprovalStatus.APPROVED]: "approved",
  [PrismaTenantApprovalStatus.REJECTED]: "rejected",
};

export const tenantApprovalToPrisma: Record<
  TenantApprovalStatus,
  PrismaTenantApprovalStatus
> = {
  pending_review: PrismaTenantApprovalStatus.PENDING_REVIEW,
  approved: PrismaTenantApprovalStatus.APPROVED,
  rejected: PrismaTenantApprovalStatus.REJECTED,
};

export const tenantStatusMap: Record<PrismaTenantStatus, TenantStatus> = {
  [PrismaTenantStatus.PROVISIONING]: "provisioning",
  [PrismaTenantStatus.TRIAL]: "trial",
  [PrismaTenantStatus.ACTIVE]: "active",
  [PrismaTenantStatus.SUSPENDED]: "suspended",
  [PrismaTenantStatus.ARCHIVED]: "archived",
};

export const tenantStatusToPrisma: Record<TenantStatus, PrismaTenantStatus> = {
  provisioning: PrismaTenantStatus.PROVISIONING,
  trial: PrismaTenantStatus.TRIAL,
  active: PrismaTenantStatus.ACTIVE,
  suspended: PrismaTenantStatus.SUSPENDED,
  archived: PrismaTenantStatus.ARCHIVED,
};

const registrationStatusMap: Record<
  PrismaRegistrationStatus,
  RegistrationStatus
> = {
  [PrismaRegistrationStatus.SUBMITTED]: "submitted",
  [PrismaRegistrationStatus.IN_REVIEW]: "in_review",
  [PrismaRegistrationStatus.APPROVED]: "approved",
  [PrismaRegistrationStatus.REJECTED]: "rejected",
};

export const registrationStatusToPrisma: Record<
  RegistrationStatus,
  PrismaRegistrationStatus
> = {
  submitted: PrismaRegistrationStatus.SUBMITTED,
  in_review: PrismaRegistrationStatus.IN_REVIEW,
  approved: PrismaRegistrationStatus.APPROVED,
  rejected: PrismaRegistrationStatus.REJECTED,
};

const checkTypeMap: Record<PrismaCheckType, RegistrationCheckType> = {
  [PrismaCheckType.BUSINESS_VERIFICATION]: "business_verification",
  [PrismaCheckType.PAYMENT_METHOD_LINKED]: "payment_method_linked",
  [PrismaCheckType.WHATSAPP_API_APPROVAL]: "whatsapp_api_approval",
};

const checkStatusMap: Record<PrismaCheckStatus, RegistrationCheckStatus> = {
  [PrismaCheckStatus.PENDING]: "pending",
  [PrismaCheckStatus.PASSED]: "passed",
  [PrismaCheckStatus.FAILED]: "failed",
};

export const checkStatusToPrisma: Record<
  RegistrationCheckStatus,
  PrismaCheckStatus
> = {
  pending: PrismaCheckStatus.PENDING,
  passed: PrismaCheckStatus.PASSED,
  failed: PrismaCheckStatus.FAILED,
};

export const checkTypeToPrisma: Record<RegistrationCheckType, PrismaCheckType> =
  {
    business_verification: PrismaCheckType.BUSINESS_VERIFICATION,
    payment_method_linked: PrismaCheckType.PAYMENT_METHOD_LINKED,
    whatsapp_api_approval: PrismaCheckType.WHATSAPP_API_APPROVAL,
  };

export const provisioningMap: Record<
  PrismaTenantDatabaseStatus,
  ProvisioningStatus
> = {
  [PrismaTenantDatabaseStatus.PENDING]: "pending",
  [PrismaTenantDatabaseStatus.PROVISIONING]: "provisioning",
  [PrismaTenantDatabaseStatus.READY]: "ready",
  [PrismaTenantDatabaseStatus.FAILED]: "failed",
};

export const provisioningToPrisma: Record<
  ProvisioningStatus,
  PrismaTenantDatabaseStatus
> = {
  pending: PrismaTenantDatabaseStatus.PENDING,
  provisioning: PrismaTenantDatabaseStatus.PROVISIONING,
  ready: PrismaTenantDatabaseStatus.READY,
  failed: PrismaTenantDatabaseStatus.FAILED,
};

const billingCycleMap: Record<PrismaBillingCycle, BillingCycle> = {
  [PrismaBillingCycle.MONTHLY]: "monthly",
  [PrismaBillingCycle.ANNUAL]: "annual",
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

const invoiceStatusMap: Record<PrismaInvoiceStatus, InvoiceStatus> = {
  [PrismaInvoiceStatus.DRAFT]: "draft",
  [PrismaInvoiceStatus.OPEN]: "open",
  [PrismaInvoiceStatus.PAID]: "paid",
  [PrismaInvoiceStatus.VOID]: "void",
  [PrismaInvoiceStatus.UNCOLLECTIBLE]: "uncollectible",
};

const aiProviderStatusMap: Record<PrismaAiProviderStatus, AiProviderStatus> = {
  [PrismaAiProviderStatus.ACTIVE]: "active",
  [PrismaAiProviderStatus.INACTIVE]: "inactive",
};

export function mapAdmin(admin: PrismaAdminUser): PlatformAdmin {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: adminRoleMap[admin.role],
    status: adminStatusMap[admin.status],
    avatarUrl: admin.avatarUrl,
    lastSignedInAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

/**
 * @param registrationCode The code of the application this tenant came from,
 * when the caller joined it. Passed rather than read off the row because
 * `tenants` stores only the id, and not every query needs the join.
 */
export function mapTenant(
  tenant: PrismaTenant,
  registrationCode: string | null = null,
): Tenant {
  return {
    id: tenant.id,
    tenantCode: tenant.tenantCode,
    slug: tenant.slug,
    businessName: tenant.businessName,
    ownerName: tenant.ownerName,
    ownerEmail: tenant.ownerEmail,
    ownerPhone: tenant.ownerPhone,
    industry: tenant.industry,
    region: tenant.businessRegion,
    // Derived, not stored: `tenants` has no URL column, and a stored one would
    // go stale the moment the root domain or the app origin changed.
    websiteUrl: buildWebsiteUrl(
      tenant.slug,
      env.TENANT_ROOT_DOMAIN,
      env.NEXT_PUBLIC_APP_URL,
    ),
    approvalStatus: tenantApprovalMap[tenant.approvalStatus],
    status: tenantStatusMap[tenant.status],
    createdAt: tenant.createdAt.toISOString(),
    registrationCode,
  };
}

export function mapTenantDatabase(
  database: PrismaTenantDatabase,
): TenantDatabase {
  return {
    id: database.id,
    tenantId: database.tenantId,
    databaseName: database.databaseName,
    region: database.region,
    status: provisioningMap[database.status],
    schemaVersion: database.schemaVersion,
    // A display label only. Host, username and secret references stay server
    // side and are never mapped into a DTO (S-03).
    instanceLabel: database.hostReference.split("/").pop() ?? "unknown",
    lastBackupAt: null,
    failureReason: null,
  };
}

/**
 * `plans.features` is untyped jsonb. Anything that does not match the versioned
 * contract degrades to an empty feature set rather than throwing, so one bad
 * row cannot take down the plan catalogue.
 */
function parsePlanFeatures(value: unknown): PlanFeatures {
  if (typeof value !== "object" || value === null) {
    return EMPTY_PLAN_FEATURES;
  }

  const candidate = value as Partial<PlanFeatures>;

  if (candidate.version !== 1) {
    return EMPTY_PLAN_FEATURES;
  }

  return {
    version: 1,
    toggles: Array.isArray(candidate.toggles) ? candidate.toggles : [],
    highlights: Array.isArray(candidate.highlights) ? candidate.highlights : [],
    accentColor: candidate.accentColor,
    popular: candidate.popular,
  };
}

export function mapPlan(plan: PrismaPlan): Plan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice?.toFixed(2) ?? null,
    annualPrice: plan.annualPrice?.toFixed(2) ?? null,
    currency: plan.currency,
    features: parsePlanFeatures(plan.features),
    sortOrder: plan.sortOrder,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    // `plans` carries no updated_at in the ERD, so there is nothing to drive
    // optimistic concurrency on plan edits (§2.9a).
    updatedAt: null,
  };
}

export function mapSubscription(
  subscription: PrismaSubscription,
): Subscription {
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    planId: subscription.planId,
    billingCycle: billingCycleMap[subscription.billingCycle],
    status: subscriptionStatusMap[subscription.status],
    priceSnapshot: subscription.priceSnapshot.toFixed(2),
    currency: subscription.currency,
    startedAt: subscription.startedAt.toISOString(),
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
  };
}

export function mapInvoice(invoice: PrismaInvoice): Invoice {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    subscriptionId: invoice.subscriptionId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoiceStatusMap[invoice.status],
    subtotal: invoice.subtotal.toFixed(2),
    tax: invoice.tax.toFixed(2),
    total: invoice.total.toFixed(2),
    currency: invoice.currency,
  };
}

export function mapRegistration(
  registration: PrismaTenantRegistration,
): TenantRegistration {
  return {
    id: registration.id,
    registrationCode: registration.registrationCode,
    businessName: registration.businessName,
    ownerName: registration.ownerName,
    ownerEmail: registration.ownerEmail,
    ownerPhone: registration.ownerPhone,
    industry: registration.industry,
    region: registration.region,
    requestedPlanId: registration.requestedPlanId,
    status: registrationStatusMap[registration.status],
    submittedAt: registration.submittedAt.toISOString(),
  };
}

export function mapRegistrationCheck(
  check: PrismaTenantRegistrationCheck,
  checkedByName: string | null,
): RegistrationCheck {
  return {
    id: check.id,
    registrationId: check.tenantRegistrationId,
    checkType: checkTypeMap[check.checkType],
    status: checkStatusMap[check.status],
    notes: check.notes,
    checkedAt: check.checkedAt?.toISOString() ?? null,
    checkedByName,
  };
}

export function mapAiProvider(provider: PrismaAiProvider): AiProvider {
  return {
    id: provider.id,
    name: provider.name,
    status: aiProviderStatusMap[provider.status],
  };
}

export function mapAiModel(model: PrismaAiModel): AiModel {
  return {
    id: model.id,
    providerId: model.aiProviderId,
    modelName: model.modelName,
    capabilities: Array.isArray(model.capabilities)
      ? model.capabilities.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    isActive: model.isActive,
  };
}
