import { describe, expect, it } from "vitest";

import { scrubAuditMetadata } from "./audit-log";

/**
 * The audit trail is read by more people than the write path is, so a
 * credential that leaks into it leaks widely and permanently.
 */
describe("scrubAuditMetadata", () => {
  it("keeps ordinary fields", () => {
    expect(
      scrubAuditMetadata({ name: "Growth", monthlyPrice: "49.00" }),
    ).toEqual({ name: "Growth", monthlyPrice: "49.00" });
  });

  it("redacts anything credential-shaped", () => {
    const scrubbed = scrubAuditMetadata({
      password: "hunter2",
      secretReference: "tenant/acme/password",
      apiKey: "sk-live-123",
      accessToken: "abc",
      dbCredential: "x",
    });

    expect(scrubbed).toEqual({
      password: "[redacted]",
      secretReference: "[redacted]",
      apiKey: "[redacted]",
      accessToken: "[redacted]",
      dbCredential: "[redacted]",
    });
  });

  it("matches regardless of casing or separators", () => {
    expect(
      scrubAuditMetadata({ Secret_Reference: "x", "API-KEY": "y" }),
    ).toEqual({ Secret_Reference: "[redacted]", "API-KEY": "[redacted]" });
  });

  it("redacts the value while keeping the key, so the shape stays readable", () => {
    const scrubbed = scrubAuditMetadata({ apiKey: "sk-live-123" }) as Record<
      string,
      unknown
    >;
    expect(Object.keys(scrubbed)).toEqual(["apiKey"]);
    expect(scrubbed.apiKey).not.toContain("sk-live");
  });

  it("returns undefined for no metadata", () => {
    expect(scrubAuditMetadata(undefined)).toBeUndefined();
  });
});
