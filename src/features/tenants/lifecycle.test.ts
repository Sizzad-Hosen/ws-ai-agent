import { describe, expect, it } from "vitest";

import {
  TENANT_APPROVAL_STATUSES,
  TENANT_STATUSES,
  type TenantApprovalStatus,
  type TenantStatus,
} from "@/types/status";

import {
  TENANT_DECISIONS,
  changeFor,
  isLegalTransition,
  type TenantStatusPair,
} from "./lifecycle";

/**
 * The UI only renders the buttons that apply, so these rules are the only real
 * guard: a stale page or a direct API call must not be able to reject a tenant
 * that is already active.
 *
 * `tenants` splits the verdict from the workspace state, so every case names
 * both columns. That split is the point of these tests: a decision must read
 * the column it writes, and ignore the other one entirely.
 */
function pair(
  approvalStatus: TenantApprovalStatus,
  status: TenantStatus,
): TenantStatusPair {
  return { approvalStatus, status };
}

/** Every combination of the two columns, for exhaustive sweeps. */
const ALL_PAIRS: readonly TenantStatusPair[] = TENANT_APPROVAL_STATUSES.flatMap(
  (approvalStatus) =>
    TENANT_STATUSES.map((status) => pair(approvalStatus, status)),
);

describe("isLegalTransition", () => {
  it("allows approve and reject only while awaiting review", () => {
    expect(
      isLegalTransition(pair("pending_review", "provisioning"), "approve"),
    ).toBe(true);
    expect(
      isLegalTransition(pair("pending_review", "provisioning"), "reject"),
    ).toBe(true);

    for (const approvalStatus of ["approved", "rejected"] as const) {
      expect(isLegalTransition(pair(approvalStatus, "active"), "approve")).toBe(
        false,
      );
      expect(isLegalTransition(pair(approvalStatus, "active"), "reject")).toBe(
        false,
      );
    }
  });

  it("ignores the lifecycle column when deciding a verdict", () => {
    // A pending application is pending whatever its workspace row happens to
    // say. Reading the wrong column here is what the split exists to prevent.
    for (const status of TENANT_STATUSES) {
      expect(isLegalTransition(pair("pending_review", status), "approve")).toBe(
        true,
      );
    }
  });

  it("allows suspend only from active or trial", () => {
    expect(isLegalTransition(pair("approved", "active"), "suspend")).toBe(true);
    expect(isLegalTransition(pair("approved", "trial"), "suspend")).toBe(true);

    for (const status of ["provisioning", "suspended", "archived"] as const) {
      expect(isLegalTransition(pair("approved", status), "suspend")).toBe(
        false,
      );
    }
  });

  it("allows reactivate only from suspended", () => {
    expect(isLegalTransition(pair("approved", "suspended"), "reactivate")).toBe(
      true,
    );

    for (const status of [
      "provisioning",
      "trial",
      "active",
      "archived",
    ] as const) {
      expect(isLegalTransition(pair("approved", status), "reactivate")).toBe(
        false,
      );
    }
  });

  it("ignores the verdict column when deciding a lifecycle move", () => {
    // Suspension is an operational act. The application was decided long ago.
    for (const approvalStatus of TENANT_APPROVAL_STATUSES) {
      expect(isLegalTransition(pair(approvalStatus, "active"), "suspend")).toBe(
        true,
      );
    }
  });

  it("never re-opens a rejected tenant or an archived workspace", () => {
    // Both are terminal: recovering one is a deliberate act, not a button.
    for (const decision of TENANT_DECISIONS) {
      expect(isLegalTransition(pair("rejected", "archived"), decision)).toBe(
        false,
      );
    }
  });

  it("has no decision that is legal from every state, or from none", () => {
    for (const decision of TENANT_DECISIONS) {
      const legal = ALL_PAIRS.filter((current) =>
        isLegalTransition(current, decision),
      );
      expect(legal.length).toBeGreaterThan(0);
      expect(legal.length).toBeLessThan(ALL_PAIRS.length);
    }
  });
});

describe("changeFor", () => {
  it("writes the verdict column, and starts provisioning on approval", () => {
    expect(changeFor("approve")).toEqual({
      approvalStatus: "approved",
      status: "provisioning",
    });
  });

  it("writes only the verdict on rejection, leaving the workspace alone", () => {
    expect(changeFor("reject")).toEqual({ approvalStatus: "rejected" });
  });

  it("writes only the lifecycle column for operational decisions", () => {
    expect(changeFor("suspend")).toEqual({ status: "suspended" });
    expect(changeFor("reactivate")).toEqual({ status: "active" });
  });

  it("never targets a state the decision is also legal from", () => {
    // Otherwise the action would be a no-op that still reported success.
    for (const decision of TENANT_DECISIONS) {
      const change = changeFor(decision);
      const after = pair(
        change.approvalStatus ?? "pending_review",
        change.status ?? "active",
      );

      // Only the column the decision writes is meaningful here; the other is
      // filled with a value the decision does not read.
      expect(isLegalTransition(after, decision)).toBe(false);
    }
  });
});
