import { describe, expect, it } from "vitest";

import {
  FALLBACK_TENANT_ROLE,
  TENANT_PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
} from "@/server/tenancy/tenant-permissions";

const ROLES = ["OWNER", "ADMIN", "AGENT", "VIEWER"] as const;

describe("tenant permissions", () => {
  it("lets an owner and an admin connect a number", () => {
    expect(
      roleHasPermission("OWNER", TENANT_PERMISSIONS.WHATSAPP_CONNECT),
    ).toBe(true);
    expect(
      roleHasPermission("ADMIN", TENANT_PERMISSIONS.WHATSAPP_CONNECT),
    ).toBe(true);
  });

  it("does not let an agent or a viewer connect a number", () => {
    // Connecting spends the plan's allowance and stores a credential that can
    // message the shop's customers. It is not a chat agent's decision.
    expect(
      roleHasPermission("AGENT", TENANT_PERMISSIONS.WHATSAPP_CONNECT),
    ).toBe(false);
    expect(
      roleHasPermission("VIEWER", TENANT_PERMISSIONS.WHATSAPP_CONNECT),
    ).toBe(false);
    expect(roleHasPermission("AGENT", TENANT_PERMISSIONS.WHATSAPP_MANAGE)).toBe(
      false,
    );
  });

  it("lets every role see the connection", () => {
    for (const role of ROLES) {
      expect(roleHasPermission(role, TENANT_PERMISSIONS.WHATSAPP_READ)).toBe(
        true,
      );
    }
  });

  it("grants every role something, and no role everything by accident", () => {
    for (const role of ROLES) {
      expect(permissionsForRole(role).length).toBeGreaterThan(0);
    }

    expect(permissionsForRole("VIEWER")).toEqual([
      TENANT_PERMISSIONS.WHATSAPP_READ,
    ]);
  });

  it("falls back to a role that can change nothing", () => {
    // The fallback is used when the two databases disagree about a user. Read
    // access keeps a half-provisioned workspace usable; write access would
    // make a disagreement into a privilege.
    expect(
      roleHasPermission(
        FALLBACK_TENANT_ROLE,
        TENANT_PERMISSIONS.WHATSAPP_CONNECT,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(FALLBACK_TENANT_ROLE, TENANT_PERMISSIONS.WHATSAPP_READ),
    ).toBe(true);
  });
});
