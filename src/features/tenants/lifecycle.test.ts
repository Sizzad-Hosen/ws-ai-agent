import { describe, expect, it } from "vitest";

import { TENANT_APPROVAL_STATUSES } from "@/types/status";

import {
  TENANT_DECISIONS,
  isLegalTransition,
  targetStatusFor,
} from "./lifecycle";

/**
 * The UI only renders the buttons that apply, so these rules are the only real
 * guard: a stale page or a direct API call must not be able to reject a tenant
 * that is already active.
 */
describe("isLegalTransition", () => {
  it("allows approve and reject only from pending review", () => {
    expect(isLegalTransition("pending_review", "approve")).toBe(true);
    expect(isLegalTransition("pending_review", "reject")).toBe(true);

    for (const status of [
      "active",
      "trial",
      "suspended",
      "rejected",
      "archived",
    ] as const) {
      expect(isLegalTransition(status, "approve")).toBe(false);
      expect(isLegalTransition(status, "reject")).toBe(false);
    }
  });

  it("allows suspend only from active or trial", () => {
    expect(isLegalTransition("active", "suspend")).toBe(true);
    expect(isLegalTransition("trial", "suspend")).toBe(true);

    for (const status of [
      "pending_review",
      "suspended",
      "rejected",
      "archived",
    ] as const) {
      expect(isLegalTransition(status, "suspend")).toBe(false);
    }
  });

  it("allows reactivate only from suspended", () => {
    expect(isLegalTransition("suspended", "reactivate")).toBe(true);

    for (const status of [
      "pending_review",
      "active",
      "trial",
      "rejected",
      "archived",
    ] as const) {
      expect(isLegalTransition(status, "reactivate")).toBe(false);
    }
  });

  it("never re-opens a rejected or archived tenant", () => {
    // These are terminal: recovering one is a deliberate act, not a button.
    for (const status of ["rejected", "archived"] as const) {
      for (const decision of TENANT_DECISIONS) {
        expect(isLegalTransition(status, decision)).toBe(false);
      }
    }
  });

  it("has no decision that is legal from every status", () => {
    for (const decision of TENANT_DECISIONS) {
      const legal = TENANT_APPROVAL_STATUSES.filter((status) =>
        isLegalTransition(status, decision),
      );
      expect(legal.length).toBeGreaterThan(0);
      expect(legal.length).toBeLessThan(TENANT_APPROVAL_STATUSES.length);
    }
  });
});

describe("targetStatusFor", () => {
  it("maps each decision to its resulting status", () => {
    expect(targetStatusFor("approve")).toBe("active");
    expect(targetStatusFor("reject")).toBe("rejected");
    expect(targetStatusFor("suspend")).toBe("suspended");
    expect(targetStatusFor("reactivate")).toBe("active");
  });

  it("never targets a status the decision is also legal from", () => {
    // Otherwise the action would be a no-op that still reported success.
    for (const decision of TENANT_DECISIONS) {
      expect(isLegalTransition(targetStatusFor(decision), decision)).toBe(
        false,
      );
    }
  });
});
