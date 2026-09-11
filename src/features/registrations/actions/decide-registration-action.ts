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
import { isAwaitingReview } from "@/types/status";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";

/** Used when a registration states no region. */
const DEFAULT_REGION = "unspecified";

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
  };
}

const inputSchema = z
  .object({
    registrationId: z.uuid("Unknown registration."),
    decision: z.enum(["approve", "reject"]),
    // Optional on the schema, required for a rejection by the refinement
    // below. `tenant_registrations.rejection_reason` is nullable because an
    // approval legitimately has none.
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(
    (value) => value.decision !== "reject" || (value.reason ?? "") !== "",
    {
      // Enforced here, not only by disabling the button: a rejection nobody
      // can explain is the one the applicant will ask about.
      message: "Give a reason for the rejection.",
      path: ["reason"],
    },
  );

/**
 * Approves or rejects a registration.
 *
 * Approval provisions in two stages, because they cannot share a transaction.
 * First the master records — tenant, invited owner, database row, subscription
 * and the audit entry — commit together or not at all: a tenant missing any of
 * them is not half-finished, it is broken. Then the physical database is
 * created and the row moves to READY or FAILED, since `CREATE DATABASE` cannot
 * run inside a transaction.
 *
 * The tenant is approved and PROVISIONING, not active: the verdict is settled
 * but the workspace is not usable until its database exists.
 *
 * Rejection creates nothing at all — no tenant, no owner, no database — and
 * records the reason it was refused.
 */
export async function decideRegistrationAction(
  input: unknown,
): Promise<RegistrationDecisionResult> {
  const actor = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { registrationId, decision, reason } = parsed.data;
  const detail =
    await repositories.registrations.findDetailById(registrationId);

  if (!detail) {
    return { success: false, message: "That registration no longer exists." };
  }

  if (!isAwaitingReview(detail.registration.status)) {
    return {
      success: false,
      message: `${detail.registration.businessName} has already been reviewed.`,
    };
  }

  if (decision === "reject") {
    const rejected = await repositories.provisioning.rejectRegistration({
      registrationId,
      // Non-null by the schema refinement above.
      reason: reason ?? "",
      actorId: actor.id,
    });

    if (!rejected) {
      return {
        success: false,
        message: "That registration was already reviewed.",
      };
    }

    // The audit row is written inside `rejectRegistration`, in the same
    // transaction as the verdict.

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
    // `tenant_registrations.region` is nullable; the database row needs a
    // value, so an unstated region falls back to the platform default.
    region: detail.registration.region ?? DEFAULT_REGION,
    actorId: actor.id,
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

  // The approval's own audit row was written inside the provisioning
  // transaction. This one records only what happened after it committed,
  // which the transaction could not know.
  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.REGISTRATION_APPROVE,
    entityType: "tenant",
    entityId: outcome.tenant.tenantId,
    tenantId: outcome.tenant.tenantId,
    metadata: {
      databaseName: outcome.tenant.databaseName,
      databaseReady: database.ok,
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
