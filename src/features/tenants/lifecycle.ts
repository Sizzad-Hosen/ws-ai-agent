import "server-only";

import type { Tenant } from "@/features/tenants/types";
import { repositories } from "@/server/repositories";
import type { TenantApprovalStatus } from "@/types/status";

export const TENANT_DECISIONS = [
  "approve",
  "reject",
  "suspend",
  "reactivate",
] as const;

export type TenantDecision = (typeof TENANT_DECISIONS)[number];

/**
 * Legal transitions, enforced on the server.
 *
 * The table only renders the buttons that apply, but a hidden button is a
 * convenience and not an access control: a stale page or a direct call must
 * not be able to reject an already-active tenant.
 *
 * These rules live here rather than in either caller so the server action and
 * the REST route cannot drift apart.
 */
const TRANSITIONS: Readonly<
  Record<
    TenantDecision,
    { from: readonly TenantApprovalStatus[]; to: TenantApprovalStatus }
  >
> = {
  approve: { from: ["pending_review"], to: "active" },
  reject: { from: ["pending_review"], to: "rejected" },
  suspend: { from: ["active", "trial"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "active" },
};

/** The status a decision moves a tenant to, regardless of where it starts. */
export function targetStatusFor(
  decision: TenantDecision,
): TenantApprovalStatus {
  return TRANSITIONS[decision].to;
}

/**
 * Whether a decision is legal from a given status.
 *
 * Exported so the rule can be tested without a database, and so neither caller
 * has to reach into the table.
 */
export function isLegalTransition(
  from: TenantApprovalStatus,
  decision: TenantDecision,
): boolean {
  return TRANSITIONS[decision].from.includes(from);
}

const PAST_TENSE: Readonly<Record<TenantDecision, string>> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reactivate: "reactivated",
};

export type TenantDecisionOutcome =
  "applied" | "not-found" | "illegal-transition" | "failed";

export interface TenantDecisionResult {
  readonly outcome: TenantDecisionOutcome;
  readonly message: string;
  /** The status the tenant now holds; null when nothing changed. */
  readonly approvalStatus: TenantApprovalStatus | null;
}

/**
 * Applies an approval or lifecycle decision to a tenant.
 *
 * Callers are responsible for authorisation and for any cache revalidation;
 * this function owns the transition rules and the write alone.
 *
 * Note: this change is not yet audited. `platform_audit_logs` is not in the
 * ERD (§2.3), so there is nowhere to record who suspended or approved what.
 * That gap should be closed before this reaches a real environment.
 */
export async function applyTenantDecision(
  tenantId: string,
  decision: TenantDecision,
): Promise<TenantDecisionResult> {
  let tenant: Tenant | null;

  try {
    tenant = await repositories.tenants.findById(tenantId);
  } catch (error: unknown) {
    console.error("Unable to load the tenant for a status decision.", error);
    return {
      outcome: "failed",
      message: "That change could not be saved. Please try again.",
      approvalStatus: null,
    };
  }

  if (!tenant) {
    return {
      outcome: "not-found",
      message: "That tenant no longer exists.",
      approvalStatus: null,
    };
  }

  if (!isLegalTransition(tenant.approvalStatus, decision)) {
    return {
      outcome: "illegal-transition",
      message: `${tenant.businessName} cannot be ${PAST_TENSE[decision]} from its current status.`,
      approvalStatus: tenant.approvalStatus,
    };
  }

  try {
    await repositories.tenants.updateApprovalStatus(
      tenantId,
      targetStatusFor(decision),
    );
  } catch (error: unknown) {
    console.error("Unable to record the tenant status decision.", error);
    return {
      outcome: "failed",
      message: "That change could not be saved. Please try again.",
      approvalStatus: tenant.approvalStatus,
    };
  }

  return {
    outcome: "applied",
    message: `${tenant.businessName} ${PAST_TENSE[decision]}.`,
    approvalStatus: targetStatusFor(decision),
  };
}
