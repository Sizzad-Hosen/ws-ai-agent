"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/config/env";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { allChecksPassed } from "@/features/registrations/types";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";

export interface RegistrationDecisionResult {
  readonly success: boolean;
  readonly message: string;
  /** Present on approval, so the reviewer sees what was created. */
  readonly provisioned?: {
    readonly tenantId: string;
    readonly tenantCode: string;
    readonly subdomain: string;
    readonly websiteUrl: string | null;
    readonly databaseName: string;
    readonly planName: string;
    /** Whether the physical database was created, and what to say if not. */
    readonly databaseReady: boolean;
    readonly databaseNote: string | null;
    /**
     * First sign-in credentials for the tenant's owner, shown once. There is no
     * invitation mail in this application, so without these the workspace has
     * nobody who can get into it.
     */
    readonly ownerEmail: string | null;
    readonly ownerPassword: string | null;
    readonly dashboardUrl: string;
  };
}

const inputSchema = z.object({
  registrationId: z.uuid("Unknown registration."),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Approves or rejects a registration.
 *
 * Approval provisions in two stages, because they cannot share a transaction.
 * First the master records — tenant, database row, subscription — commit
 * together or not at all: a tenant missing either is not half-finished, it is
 * broken. Then the physical database is created and the row moves to READY or
 * FAILED, since `CREATE DATABASE` cannot run inside a transaction.
 *
 * The tenant starts on TRIAL because its subscription genuinely is trialing,
 * not because the workspace is incomplete.
 */
export async function decideRegistrationAction(
  input: unknown,
): Promise<RegistrationDecisionResult> {
  const actor = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { registrationId, decision } = parsed.data;
  const detail =
    await repositories.registrations.findDetailById(registrationId);

  if (!detail) {
    return { success: false, message: "That registration no longer exists." };
  }

  if (detail.registration.status !== "pending_review") {
    return {
      success: false,
      message: `${detail.registration.businessName} has already been reviewed.`,
    };
  }

  if (decision === "reject") {
    const rejected =
      await repositories.provisioning.rejectRegistration(registrationId);

    if (!rejected) {
      return {
        success: false,
        message: "That registration was already reviewed.",
      };
    }

    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.REGISTRATION_REJECT,
      entityType: "registration",
      entityId: registrationId,
      metadata: {
        businessName: detail.registration.businessName,
        registrationCode: detail.registration.registrationCode,
      },
    });

    revalidateReviewSurfaces(registrationId);

    return {
      success: true,
      message: `${detail.registration.businessName} rejected.`,
    };
  }

  // The checklist gate is enforced here, not only by disabling the button: a
  // stale page must not be able to approve an unchecked registration.
  if (!allChecksPassed(detail.checks)) {
    return {
      success: false,
      message: "Every verification check must pass before approval.",
    };
  }

  const plan = await selectPlan(detail.registration.requestedPlanId);

  if (!plan) {
    return {
      success: false,
      message:
        "No priced plan is available to assign. Activate a plan with a monthly price before approving tenants.",
    };
  }

  const outcome = await repositories.provisioning.provisionApprovedTenant({
    registrationId,
    planId: plan.id,
    priceSnapshot: plan.monthlyPrice,
    currency: plan.currency,
    rootDomain: env.TENANT_ROOT_DOMAIN,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    region: detail.registration.region,
  });

  if (!outcome.ok) {
    return {
      success: false,
      message: failureMessage(outcome.reason, detail.registration.businessName),
    };
  }

  // The physical database, once the master transaction has committed. It runs
  // here rather than inside that transaction because CREATE DATABASE cannot be
  // transactional; a failure leaves the tenant in place with its database row
  // marked FAILED, which the tenant detail screen surfaces and a retry fixes.
  const database = await provisionDatabaseForTenant(outcome.tenant.tenantId);

  // Everything the approval created, so the trail explains the new tenant.
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.REGISTRATION_APPROVE,
    entityType: "registration",
    entityId: registrationId,
    metadata: {
      businessName: detail.registration.businessName,
      registrationCode: detail.registration.registrationCode,
      tenantId: outcome.tenant.tenantId,
      tenantCode: outcome.tenant.tenantCode,
      subdomain: outcome.tenant.subdomain,
      databaseName: outcome.tenant.databaseName,
      planName: plan.name,
      priceSnapshot: plan.monthlyPrice,
      currency: plan.currency,
      databaseReady: database.ok,
      // The owner's password is deliberately absent: the audit trail is read by
      // more people than the approval flow is.
      ownerSeeded: database.ok && database.ownerEmail !== null,
    },
  });

  revalidateReviewSurfaces(registrationId);
  revalidatePath(ROUTES.bo.tenant(outcome.tenant.tenantId));

  return {
    success: true,
    message: database.ok
      ? `${detail.registration.businessName} approved and provisioned on the ${plan.name} plan.`
      : `${detail.registration.businessName} approved on the ${plan.name} plan, but its database could not be created. The tenant exists and the database can be retried.`,
    provisioned: {
      ...outcome.tenant,
      planName: plan.name,
      databaseReady: database.ok,
      databaseNote: database.ok ? null : database.reason,
      ownerEmail: database.ok ? database.ownerEmail : null,
      ownerPassword: database.ok ? database.ownerPassword : null,
      dashboardUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}${tenantBasePath(outcome.tenant.subdomain)}/dashboard`,
    },
  };
}

/**
 * The plan a new tenant is placed on.
 *
 * `subscriptions.price_snapshot` is NOT NULL as drawn, so a negotiated "Custom"
 * plan cannot be subscribed at all (§2.7 / D-04). Only priced, active plans are
 * eligible; the requested plan wins when it qualifies, otherwise the cheapest
 * entry tier by catalogue order.
 */
async function selectPlan(requestedPlanId: string | null): Promise<{
  readonly id: string;
  readonly name: string;
  readonly monthlyPrice: string;
  readonly currency: string;
} | null> {
  const eligible = (await repositories.plans.findAll())
    .map((item) => item.plan)
    .filter((plan) => plan.isActive && plan.monthlyPrice !== null);

  const requested =
    requestedPlanId === null
      ? undefined
      : eligible.find((plan) => plan.id === requestedPlanId);

  const chosen = requested ?? eligible[0];

  if (!chosen?.monthlyPrice) return null;

  return {
    id: chosen.id,
    name: chosen.name,
    monthlyPrice: chosen.monthlyPrice,
    currency: chosen.currency,
  };
}

function failureMessage(
  reason: "not-pending" | "no-subdomain" | "already-provisioned" | "failed",
  businessName: string,
): string {
  switch (reason) {
    case "not-pending":
      return "That registration was reviewed by someone else a moment ago.";
    case "no-subdomain":
      return `"${businessName}" does not yield a usable web address. Give the business a name containing Latin letters or digits before approving.`;
    case "already-provisioned":
      return "A tenant already exists for this owner's email address.";
    default:
      return "Provisioning failed and nothing was changed. Please try again.";
  }
}

function revalidateReviewSurfaces(registrationId: string): void {
  revalidatePath(ROUTES.bo.registration(registrationId));
  revalidatePath(ROUTES.bo.registrations);
  revalidatePath(ROUTES.bo.tenants);
  revalidatePath(ROUTES.bo.dashboard);
}
