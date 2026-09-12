import { describe, expect, it } from "vitest";

import {
  categorySchema,
  firstVariantSchema,
  productSchema,
  variantSchema,
} from "./schemas";

// Version 4, variant 8: Zod checks both nibbles, and `@default(uuid())`
// in the tenant schema produces exactly this shape.
const VALID_UUID = "11111111-2222-4333-8444-555555555555";

function product(overrides: Record<string, unknown> = {}) {
  return {
    name: "Basmati Rice 5kg",
    slug: "basmati-rice-5kg",
    description: "",
    categoryId: "",
    status: "ACTIVE",
    basePrice: "890.00",
    compareAtPrice: "",
    ...overrides,
  };
}

function variant(overrides: Record<string, unknown> = {}) {
  return {
    sku: "RICE-BAS-5K",
    price: "890.00",
    compareAtPrice: "",
    isActive: true,
    quantity: 12,
    reorderLevel: null,
    ...overrides,
  };
}

describe("productSchema", () => {
  it("accepts a well-formed product", () => {
    expect(productSchema.safeParse(product()).success).toBe(true);
  });

  it("turns an empty optional into null rather than an empty string", () => {
    const parsed = productSchema.parse(product());
    expect(parsed.description).toBeNull();
    expect(parsed.categoryId).toBeNull();
    expect(parsed.compareAtPrice).toBeNull();
  });

  it("keeps a category id when one is chosen", () => {
    const parsed = productSchema.parse(product({ categoryId: VALID_UUID }));
    expect(parsed.categoryId).toBe(VALID_UUID);
  });

  it("rejects a category id that is not a uuid", () => {
    expect(
      productSchema.safeParse(product({ categoryId: "abc" })).success,
    ).toBe(false);
  });

  it.each([
    ["no decimals", "890"],
    ["one decimal", "890.5"],
    ["two decimals", "890.50"],
  ])("accepts a price with %s", (_label, basePrice) => {
    expect(productSchema.safeParse(product({ basePrice })).success).toBe(true);
  });

  it.each([
    ["three decimals, which the column cannot hold", "890.505"],
    ["a negative amount", "-1"],
    ["a thousands separator", "1,890.00"],
    ["a currency symbol", "$890"],
    ["empty", ""],
    ["letters", "eight"],
  ])("rejects a price with %s", (_label, basePrice) => {
    expect(productSchema.safeParse(product({ basePrice })).success).toBe(false);
  });

  it("preserves a trailing zero, which a float would lose", () => {
    expect(productSchema.parse(product({ basePrice: "12.10" })).basePrice).toBe(
      "12.10",
    );
  });

  it("rejects a compare-at price at or below the price", () => {
    // A discount of zero or less is not a discount, and showing one is worse
    // than showing none.
    expect(
      productSchema.safeParse(product({ compareAtPrice: "890.00" })).success,
    ).toBe(false);
    expect(
      productSchema.safeParse(product({ compareAtPrice: "800.00" })).success,
    ).toBe(false);
  });

  it("accepts a compare-at price above the price", () => {
    expect(
      productSchema.safeParse(product({ compareAtPrice: "990.00" })).success,
    ).toBe(true);
  });

  it("rejects a status outside the enum", () => {
    expect(productSchema.safeParse(product({ status: "LIVE" })).success).toBe(
      false,
    );
  });

  it("rejects an unknown field rather than ignoring it", () => {
    expect(
      productSchema.safeParse({ ...product(), isFeatured: true }).success,
    ).toBe(false);
  });

  it("rejects a name longer than the column", () => {
    expect(
      productSchema.safeParse(product({ name: "x".repeat(221) })).success,
    ).toBe(false);
  });

  it.each(["blue shirt", "blue--shirt", "-blue", "blue/shirt", ""])(
    "rejects the slug %s",
    (slug) => {
      expect(productSchema.safeParse(product({ slug })).success).toBe(false);
    },
  );

  it("normalises a slug typed in capitals rather than refusing it", () => {
    expect(productSchema.parse(product({ slug: "Blue-Shirt" })).slug).toBe(
      "blue-shirt",
    );
  });
});

describe("categorySchema", () => {
  it("accepts a well-formed category", () => {
    const parsed = categorySchema.safeParse({
      name: "Pantry",
      slug: "pantry",
      description: "",
      parentId: "",
      isActive: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("reads an empty parent as top level, not as missing", () => {
    const parsed = categorySchema.parse({
      name: "Pantry",
      slug: "pantry",
      description: "",
      parentId: "",
      isActive: true,
    });

    expect(parsed.parentId).toBeNull();
  });

  it("lowercases a slug typed in capitals", () => {
    const parsed = categorySchema.parse({
      name: "Pantry",
      slug: "PANTRY",
      description: "",
      parentId: "",
      isActive: true,
    });

    expect(parsed.slug).toBe("pantry");
  });
});

describe("variantSchema", () => {
  it("accepts a well-formed variant", () => {
    expect(variantSchema.safeParse(variant()).success).toBe(true);
  });

  it("uppercases a SKU so casing cannot defeat the unique index", () => {
    expect(variantSchema.parse(variant({ sku: "rice-bas-5k" })).sku).toBe(
      "RICE-BAS-5K",
    );
  });

  it.each([
    ["a space", "RICE BAS"],
    ["a leading hyphen", "-RICE"],
    ["a slash", "RICE/BAS"],
    ["empty", ""],
  ])("rejects a SKU with %s", (_label, sku) => {
    expect(variantSchema.safeParse(variant({ sku })).success).toBe(false);
  });

  it("rejects negative stock", () => {
    expect(variantSchema.safeParse(variant({ quantity: -1 })).success).toBe(
      false,
    );
  });

  it("rejects fractional stock", () => {
    expect(variantSchema.safeParse(variant({ quantity: 1.5 })).success).toBe(
      false,
    );
  });

  it("accepts zero stock, which is out of stock rather than invalid", () => {
    expect(variantSchema.safeParse(variant({ quantity: 0 })).success).toBe(
      true,
    );
  });

  it("accepts a null reorder level", () => {
    expect(
      variantSchema.safeParse(variant({ reorderLevel: null })).success,
    ).toBe(true);
  });
});

describe("firstVariantSchema", () => {
  it("asks only for what the create form collects", () => {
    expect(
      firstVariantSchema.safeParse({ sku: "RICE-BAS-5K", quantity: 10 })
        .success,
    ).toBe(true);
  });

  it("rejects extra fields, so the create form cannot smuggle a price", () => {
    expect(
      firstVariantSchema.safeParse({
        sku: "RICE-BAS-5K",
        quantity: 10,
        price: "1.00",
      }).success,
    ).toBe(false);
  });
});
