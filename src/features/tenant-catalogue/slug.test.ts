import { describe, expect, it } from "vitest";

import {
  deriveSlug,
  isValidSlug,
  MAX_CATEGORY_SLUG,
  MAX_PRODUCT_SLUG,
  withSuffix,
} from "./slug";

describe("deriveSlug", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(deriveSlug("Blue Cotton Shirt", MAX_PRODUCT_SLUG)).toBe(
      "blue-cotton-shirt",
    );
  });

  it("folds diacritics instead of dropping the letter", () => {
    expect(deriveSlug("Café Niño", MAX_PRODUCT_SLUG)).toBe("cafe-nino");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(deriveSlug("  Wayne   Ent. -- Ltd.  ", MAX_PRODUCT_SLUG)).toBe(
      "wayne-ent-ltd",
    );
  });

  it("returns null when no Latin characters survive", () => {
    expect(deriveSlug("বাংলা", MAX_PRODUCT_SLUG)).toBeNull();
    expect(deriveSlug("!!!", MAX_PRODUCT_SLUG)).toBeNull();
    expect(deriveSlug("", MAX_PRODUCT_SLUG)).toBeNull();
  });

  it("keeps digits", () => {
    expect(deriveSlug("Rice 5kg", MAX_PRODUCT_SLUG)).toBe("rice-5kg");
  });

  it("respects the column limit and never ends on a hyphen", () => {
    const slug = deriveSlug(
      `${"a".repeat(MAX_CATEGORY_SLUG - 1)} b`,
      MAX_CATEGORY_SLUG,
    );

    expect(slug?.length).toBeLessThanOrEqual(MAX_CATEGORY_SLUG);
    expect(slug?.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it.each(["blue-shirt", "rice-5kg", "a", "a1"])("accepts %s", (slug) => {
    expect(isValidSlug(slug, MAX_PRODUCT_SLUG)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["leading hyphen", "-blue"],
    ["trailing hyphen", "blue-"],
    ["double hyphen", "blue--shirt"],
    ["uppercase", "Blue-Shirt"],
    ["spaces", "blue shirt"],
    ["underscore", "blue_shirt"],
    ["slash, which would break the URL", "blue/shirt"],
  ])("rejects %s", (_label, slug) => {
    expect(isValidSlug(slug, MAX_PRODUCT_SLUG)).toBe(false);
  });

  it("rejects a slug longer than the column", () => {
    expect(
      isValidSlug("a".repeat(MAX_PRODUCT_SLUG + 1), MAX_PRODUCT_SLUG),
    ).toBe(false);
  });
});

describe("withSuffix", () => {
  it("leaves the first attempt alone", () => {
    expect(withSuffix("blue-shirt", 1, MAX_PRODUCT_SLUG)).toBe("blue-shirt");
  });

  it("appends the attempt number on a collision", () => {
    expect(withSuffix("blue-shirt", 2, MAX_PRODUCT_SLUG)).toBe("blue-shirt-2");
  });

  it("stays inside the column limit", () => {
    const long = "a".repeat(MAX_PRODUCT_SLUG);
    const suffixed = withSuffix(long, 12, MAX_PRODUCT_SLUG);

    expect(suffixed.length).toBeLessThanOrEqual(MAX_PRODUCT_SLUG);
    expect(suffixed.endsWith("-12")).toBe(true);
  });

  it("never produces a double hyphen when it truncates", () => {
    const slug = withSuffix(
      `${"a".repeat(MAX_PRODUCT_SLUG - 3)}-b`,
      2,
      MAX_PRODUCT_SLUG,
    );
    expect(slug).not.toContain("--");
  });

  it("produces a slug that still validates", () => {
    expect(
      isValidSlug(
        withSuffix("blue-shirt", 3, MAX_PRODUCT_SLUG),
        MAX_PRODUCT_SLUG,
      ),
    ).toBe(true);
  });
});
