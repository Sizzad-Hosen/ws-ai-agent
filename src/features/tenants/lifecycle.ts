import "server-only";

import type { Tenant } from "@/features/tenants/types";
import {
  AUDIT_ACTIONS,
  recordAudit,
  type AuditAction,
} from "@/server/audit/audit-log";
import type { BoSessionAdmin } from "@/server/auth/types";
import type { TenantStatusChange } from "@/server/repositories/contracts/tenant-repository";
import { repositories } from "@/server/repositories";
import type { TenantApprovalStatus, TenantStatus } from "@/types/status";

export const TENANT_DECISIONS = [
  "approve",
  "reject",
  "suspend",
  "reactivate",
] as const;

export type TenantDecision = (typeof TENANT_DECISIONS)[number];

/** The two status columns a decision reads, and may write. */
export interface TenantStatusPair {
  readonly approvalStatus: TenantApprovalStatus;
  readonly status: TenantStatus;
}

/**
 * Legal transitions, enforced on the server.
 *
 * `tenants` carries two status columns and a decision moves exactly one of
 * them. Approving or rejecting is a verdict on the application, so it reads and
 * writes `approval_status`; suspending or reactivating is an operational act on
 * a workspace that was approved long ago, so it reads and writes `status`.
 * Testing a suspension against the approval column — as the merged-column
 * schema forced — would let an approved-but-archived tenant be suspended.
 *
 * The table only renders the buttons that apply, but a hidden button is a
 * convenience and not an access control: a stale page or a direct call must
 * not be able to reject an already-active tenant.
 *
 * These rules live here rather than in either caller so the server action and
 * the REST route cannot drift apart.
 */
type Transition =
  | {
      readonly kind: "approval";
      readonly from: readonly TenantApprovalStatus[];
      readonly to: TenantApprovalStatus;
      /** Approval also starts the workspace. Rejection leaves it untouched. */
      readonly thenStatus?: TenantStatus;
    }
  | {
      readonly kind: "lifecycle";
      readonly from: readonly TenantStatus[];
      readonly to: TenantStatus;
    };

const TRANSITIONS: Readonly<Record<TenantDecision, Transition>> = {
  approve: {
    kind: "approval",
    from: ["pending_review"],
    to: "approved",
    // Approved is a verdict, not a running workspace: the database still has
    // to be built before the tenant is anything but provisioning.
    thenStatus: "provisioning",
  },
  reject: { kind: "approval", from: ["pending_review"], to: "rejected" },
  suspend: { kind: "lifecycle", from: ["active", "trial"], to: "suspended" },
  reactivate: { kind: "lifecycle", from: ["suspended"], to: "active" },
};

/** The columns a decision writes, regardless of where the tenant starts. */
export function changeFor(decision: TenantDecision): TenantStatusChange {
  const transition = TRANSITIONS[decision];

  return transition.kind === "approval"
    ? {
        approvalStatus: transition.to,
        ...(transition.thenStatus ? { status: transition.thenStatus } : {}),
      }
    : { status: transition.to };
}

/**
 * Whether a decision is legal for a tenant's current pair of statuses.
 *
 * Exported so the rule can be tested without a database, and so neither caller
 * has to reach into the table.
 */
export function isLegalTransition(
  current: TenantStatusPair,
  decision: TenantDecision,
): boolean {
  const transition = TRANSITIONS[decision];

  return transition.kind === "approval"
    ? transition.from.includes(current.approvalStatus)
    : transition.from.includes(current.status);
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
  /** The statuses the tenant now holds; null when nothing changed. */
  readonly statuses: TenantStatusPair | null;
}

const AUDIT_ACTION_FOR: Readonly<Record<TenantDecision, AuditAction>> = {
  approve: AUDIT_ACTIONS.TENANT_APPROVE,
  reject: AUDIT_ACTIONS.TENANT_REJECT,
  suspend: AUDIT_ACTIONS.TENANT_SUSPEND,
  reactivate: AUDIT_ACTIONS.TENANT_REACTIVATE,
};

/**
 * Applies an approval or lifecycle decision to a tenant.
 *
 * Callers are responsible for authorisation and for any cache revalidation;
 * this function owns the transition rules, the write, and the audit entry.
 *
 * The audit is written here rather than in each caller because the server
 * action and the REST route both come through this function: recording it at
 * the entry points would mean a new entry point could silently skip it.
 */
export async function applyTenantDecision(
  tenantId: string,
  decision: TenantDecision,
  actor: BoSessionAdmin,
): Promise<TenantDecisionResult> {
  let tenant: Tenant | null;

  try {
    tenant = await repositories.tenants.findById(tenantId);
  } catch (error: unknown) {
    console.error("Unable to load the tenant for a status decision.", error);
    return {
      outcome: "failed",
      message: "That change could not be saved. Please try again.",
      statuses: null,
    };
  }

  if (!tenant) {
    return {
      outcome: "not-found",
      message: "That tenant no longer exists.",
      statuses: null,
    };
  }

  const before: TenantStatusPair = {
    approvalStatus: tenant.approvalStatus,
    status: tenant.status,
  };

  if (!isLegalTransition(before, decision)) {
    return {
      outcome: "illegal-transition",
      message: `${tenant.businessName} cannot be ${PAST_TENSE[decision]} from its current status.`,
      statuses: before,
    };
  }

  const change = changeFor(decision);
  const after: TenantStatusPair = { ...before, ...change };

  try {
    await repositories.tenants.updateStatuses(tenantId, change);
  } catch (error: unknown) {
    console.error("Unable to record the tenant status decision.", error);
    return {
      outcome: "failed",
      message: "That change could not be saved. Please try again.",
      statuses: before,
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTION_FOR[decision],
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    // Both columns, because a reader cannot tell which one moved otherwise.
    metadata: {
      businessName: tenant.businessName,
      from: before,
      to: after,
    },
  });

  return {
    outcome: "applied",
    message: `${tenant.businessName} ${PAST_TENSE[decision]}.`,
    statuses: after,
  };
}
