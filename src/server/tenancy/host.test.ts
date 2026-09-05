import { describe, expect, it } from "vitest";

import { isReservedLabel, normalizeHost, tenantLabelFromHost } from "./host";

const ROOT = "example.com";

/**
 * Host parsing decides which tenant's data a request may see, so the property
 * under test is not "does it parse" but "does it refuse everything doubtful".
 * A wrong answer here serves one tenant on another tenant's host.
 */
describe("tenantLabelFromHost", () => {
  it("accepts a single label under the configured root", () => {
    expect(tenantLabelFromHost("acme.example.com", ROOT)).toBe("acme");
  });

  it("folds case and strips the port", () => {
    expect(tenantLabelFromHost("ACME.Example.COM:3000", ROOT)).toBe("acme");
  });

  it("accepts inner hyphens and digits", () => {
    expect(tenantLabelFromHost("acme-2.example.com", ROOT)).toBe("acme-2");
    expect(tenantLabelFromHost("shop123.example.com", ROOT)).toBe("shop123");
  });

  describe("refuses anything that is not exactly one tenant label", () => {
    const refused: readonly [string, string][] = [
      ["the apex is the platform", "example.com"],
      ["a nested label is not the first label", "a.b.example.com"],
      ["a different root domain", "acme.evil.com"],
      ["the root as a prefix of another domain", "acme.example.com.evil.com"],
      ["a root that merely ends the same way", "acme.notexample.com"],
      ["an empty host", ""],
      ["a leading hyphen", "-acme.example.com"],
      ["a trailing hyphen", "acme-.example.com"],
      ["an underscore", "ac_me.example.com"],
      [
        "a label over the 63-character DNS limit",
        `${"a".repeat(64)}.example.com`,
      ],
    ];

    for (const [why, host] of refused) {
      it(why, () => {
        expect(tenantLabelFromHost(host, ROOT)).toBeNull();
      });
    }
  });

  it("refuses every reserved platform label", () => {
    for (const label of ["www", "app", "api", "admin", "bo", "mail", "cdn"]) {
      expect(tenantLabelFromHost(`${label}.example.com`, ROOT)).toBeNull();
    }
  });

  it("disables routing entirely when no root domain is configured", () => {
    // The safe default: with no root, no host can be mistaken for a tenant.
    expect(tenantLabelFromHost("acme.example.com", "")).toBeNull();
    expect(tenantLabelFromHost("anything.at.all", "   ")).toBeNull();
  });

  it("accepts a label of exactly 63 characters", () => {
    const label = "a".repeat(63);
    expect(tenantLabelFromHost(`${label}.example.com`, ROOT)).toBe(label);
  });

  it("tolerates a mixed-case root domain", () => {
    expect(tenantLabelFromHost("acme.example.com", "EXAMPLE.COM")).toBe("acme");
  });
});

describe("normalizeHost", () => {
  it("returns an empty string for nullish input", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost(undefined)).toBe("");
  });

  it("strips IPv6 brackets along with the port", () => {
    expect(normalizeHost("[::1]:3000")).toBe("");
  });
});

describe("isReservedLabel", () => {
  it("is case-insensitive", () => {
    expect(isReservedLabel("API")).toBe(true);
    expect(isReservedLabel("acme")).toBe(false);
  });
});
