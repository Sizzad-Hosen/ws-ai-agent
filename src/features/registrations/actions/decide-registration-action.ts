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
  };
}

const inputSchema = z.object({
  registrationId: z.uuid("Unknown registration."),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Approves or rejects a registration.
 *
 * Approval provisions: it creates the tenant, its database record and its
 * subscription in one transaction and marks the registration approved. Nothing
 * here creates an actual database — that is an infrastructure job — so the
 * database row is written PENDING and the tenant starts on TRIAL rather than
 * ACTIVE. Claiming ACTIVE for a workspace with no database would be a lie the
 * whole console then repeats.
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
    region: detail.registration.region,
  });

  if (!outcome.ok) {
    return {
      success: false,
      message: failureMessage(outcome.reason, detail.registration.businessName),
    };
  }

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
    },
  });

  revalidateReviewSurfaces(registrationId);
  revalidatePath(ROUTES.bo.tenant(outcome.tenant.tenantId));

  return {
    success: true,
    message: `${detail.registration.businessName} approved and provisioned on the ${plan.name} plan.`,
    provisioned: { ...outcome.tenant, planName: plan.name },
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
