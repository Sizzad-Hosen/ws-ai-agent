import { describe, expect, it } from "vitest";

import {
  TENANT_APPROVAL_STATUSES,
  TENANT_DISPLAY_STATUSES,
  TENANT_STATUSES,
  tenantDisplayStatus,
  type TenantApprovalStatus,
  type TenantStatus,
} from "@/types/status";

/**
 * The console shows one status per tenant, derived from the two columns
 * `tenants` actually stores.
 *
 * The filter in `PrismaTenantRepository` is the inverse of this function, so
 * these cases are also the specification that filter is written against:
 * filtering on "approved" must return exactly the rows badged approved, and a
 * tenant must never be invisible under every filter.
 */
function pair(approvalStatus: TenantApprovalStatus, status: TenantStatus) {
  return { approvalStatus, status };
}

const ALL_PAIRS = TENANT_APPROVAL_STATUSES.flatMap((approvalStatus) =>
  TENANT_STATUSES.map((status) => pair(approvalStatus, status)),
);

describe("tenantDisplayStatus", () => {
  it("reports a pending application as pending, whatever its workspace says", () => {
    // A row awaiting review has no meaningful lifecycle yet, so the lifecycle
    // column must not be able to disguise it as something already decided.
    for (const status of TENANT_STATUSES) {
      expect(tenantDisplayStatus(pair("pending_review", status))).toBe(
        "pending",
      );
    }
  });

  it("reports a rejected application as rejected, whatever its workspace says", () => {
    for (const status of TENANT_STATUSES) {
      expect(tenantDisplayStatus(pair("rejected", status))).toBe("rejected");
    }
  });

  it("reports an approved but suspended tenant as suspended", () => {
    // Suspension is the one lifecycle state that outranks the verdict: an
    // operator scanning the list needs to see that this workspace is stopped.
    expect(tenantDisplayStatus(pair("approved", "suspended"))).toBe(
      "suspended",
    );
  });

  it("reports every other approved tenant as approved", () => {
    for (const status of [
      "provisioning",
      "trial",
      "active",
      "archived",
    ] as const) {
      expect(tenantDisplayStatus(pair("approved", status))).toBe("approved");
    }
  });

  it("maps every stored combination to one of the four", () => {
    // No tenant can fall outside the filter set and become unreachable.
    for (const current of ALL_PAIRS) {
      expect(TENANT_DISPLAY_STATUSES).toContain(tenantDisplayStatus(current));
    }
  });

  it("uses all four, so no filter option is dead", () => {
    const reachable = new Set(ALL_PAIRS.map(tenantDisplayStatus));
    expect([...reachable].sort()).toEqual([...TENANT_DISPLAY_STATUSES].sort());
  });
});
