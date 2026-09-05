import { describe, expect, it } from "vitest";

import {
  buildWebsiteUrl,
  deriveDatabaseName,
  deriveSubdomain,
  formatTenantCode,
  withSuffix,
} from "./provisioning";

/**
 * These names become a tenant's permanent web address and database, so the
 * cases that matter are the ones that would otherwise produce an invalid DNS
 * label or a silently truncated identifier.
 */
describe("deriveSubdomain", () => {
  it("slugifies a business name", () => {
    expect(deriveSubdomain("Acme Corp")).toBe("acme-corp");
    expect(deriveSubdomain("  Wayne Ent.  ")).toBe("wayne-ent");
  });

  it("folds diacritics rather than dropping the letter", () => {
    expect(deriveSubdomain("Café Niño")).toBe("cafe-nino");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(deriveSubdomain("A & B  ---  C")).toBe("a-b-c");
  });

  it("never leaves a leading or trailing hyphen", () => {
    // Both are invalid DNS labels.
    expect(deriveSubdomain("---Acme---")).toBe("acme");
    expect(deriveSubdomain("!Acme!")).toBe("acme");
  });

  it("stays inside the 63-character DNS limit without a trailing hyphen", () => {
    const label = deriveSubdomain(`${"ab ".repeat(40)}`);
    expect(label).not.toBeNull();
    expect(label!.length).toBeLessThanOrEqual(63);
    expect(label!.endsWith("-")).toBe(false);
  });

  it("returns null when nothing usable survives", () => {
    // Refusing beats inventing an address the owner would not recognise.
    expect(deriveSubdomain("!!!")).toBeNull();
    expect(deriveSubdomain("日本語")).toBeNull();
    expect(deriveSubdomain("   ")).toBeNull();
  });
});

describe("withSuffix", () => {
  it("leaves the first attempt unsuffixed", () => {
    expect(withSuffix("acme", 1)).toBe("acme");
    expect(withSuffix("acme", 0)).toBe("acme");
  });

  it("suffixes later attempts", () => {
    expect(withSuffix("acme", 2)).toBe("acme-2");
    expect(withSuffix("acme", 17)).toBe("acme-17");
  });

  it("keeps a long label inside the limit once suffixed", () => {
    const suffixed = withSuffix("a".repeat(63), 12);
    expect(suffixed.length).toBeLessThanOrEqual(63);
    expect(suffixed.endsWith("-12")).toBe(true);
  });

  it("does not produce a double hyphen when trimming", () => {
    expect(withSuffix(`${"a".repeat(60)}-bb`, 2)).not.toContain("--");
  });
});

describe("deriveDatabaseName", () => {
  it("prefixes and converts hyphens to underscores", () => {
    expect(deriveDatabaseName("acme-corp")).toBe("sp_tenant_acme_corp");
  });

  it("stays inside the 150-character column", () => {
    expect(deriveDatabaseName("a".repeat(200)).length).toBeLessThanOrEqual(150);
  });
});

describe("buildWebsiteUrl", () => {
  it("builds an https URL under the root domain", () => {
    expect(buildWebsiteUrl("acme", "example.com")).toBe(
      "https://acme.example.com",
    );
  });

  it("returns null when no root domain is configured", () => {
    // An unroutable URL on the tenants list is worse than an honest blank.
    expect(buildWebsiteUrl("acme", "")).toBeNull();
    expect(buildWebsiteUrl("acme", "   ")).toBeNull();
  });

  it("lower-cases the root domain", () => {
    expect(buildWebsiteUrl("acme", "Example.COM")).toBe(
      "https://acme.example.com",
    );
  });
});

describe("formatTenantCode", () => {
  it("zero-pads to five digits so codes sort correctly as text", () => {
    expect(formatTenantCode(1)).toBe("TEN-00001");
    expect(formatTenantCode(10_251)).toBe("TEN-10251");
  });
});
