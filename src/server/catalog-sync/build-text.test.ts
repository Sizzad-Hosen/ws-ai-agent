import { describe, expect, it } from "vitest";

import { buildEmbeddableText, type EmbeddableProduct } from "./build-text";

/**
 * The hash decides whether an embedding call happens, so these tests are about
 * money and correctness in equal measure: a hash that moves when nothing
 * meaningful changed re-embeds a catalogue for nothing, and a hash that stays
 * put when something did leaves the index describing a product that no longer
 * exists.
 */

function product(
  overrides: Partial<EmbeddableProduct> = {},
): EmbeddableProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Premium Basmati Rice",
    slug: "premium-basmati-rice",
    description: "Aged long-grain rice, 5kg bag.",
    status: "ACTIVE",
    attributes: { origin: "Dinajpur", weight: "5kg" },
    categoryPath: ["Groceries", "Rice"],
    skus: ["RICE-5KG"],
    ...overrides,
  };
}

describe("buildEmbeddableText", () => {
  it("is deterministic for the same product", () => {
    const first = buildEmbeddableText(product());
    const second = buildEmbeddableText(product());

    expect(first.text).toBe(second.text);
    expect(first.contentHash).toBe(second.contentHash);
  });

  it("includes what describes the product", () => {
    const { text } = buildEmbeddableText(product());

    expect(text).toContain("Premium Basmati Rice");
    expect(text).toContain("Groceries > Rice");
    expect(text).toContain("Aged long-grain rice");
    expect(text).toContain("origin: Dinajpur");
    expect(text).toContain("RICE-5KG");
  });

  it("does not depend on attribute key order", () => {
    // The same attributes, a different JSON object. A hash that moved here
    // would re-embed the catalogue on every write that touched the column.
    const ordered = buildEmbeddableText(
      product({ attributes: { origin: "Dinajpur", weight: "5kg" } }),
    );
    const reversed = buildEmbeddableText(
      product({ attributes: { weight: "5kg", origin: "Dinajpur" } }),
    );

    expect(reversed.contentHash).toBe(ordered.contentHash);
  });

  it("does not depend on SKU order or on whitespace", () => {
    const first = buildEmbeddableText(product({ skus: ["A-1", "B-2"] }));
    const second = buildEmbeddableText(product({ skus: ["B-2", "A-1"] }));

    expect(second.contentHash).toBe(first.contentHash);

    const spaced = buildEmbeddableText(
      product({ name: "Premium   Basmati\n Rice" }),
    );

    expect(spaced.contentHash).toBe(buildEmbeddableText(product()).contentHash);
  });

  it("normalises Bangla to NFC before hashing", () => {
    // "য়" has two encodings: one code point, or "য" plus a nukta. Two
    // spellings of one name are one product, and must not embed twice or
    // thrash between hashes. Decomposed explicitly, because a source file
    // saved as NFC would make this assertion vacuous.
    const name = "রায়হান";

    expect(name.normalize("NFD")).not.toBe(name);

    const composed = buildEmbeddableText(product({ name }));
    const decomposed = buildEmbeddableText(
      product({ name: name.normalize("NFD") }),
    );

    expect(decomposed.contentHash).toBe(composed.contentHash);
  });

  it("changes when something describable changes", () => {
    const base = buildEmbeddableText(product()).contentHash;

    expect(
      buildEmbeddableText(product({ name: "Other" })).contentHash,
    ).not.toBe(base);
    expect(
      buildEmbeddableText(product({ description: "Different." })).contentHash,
    ).not.toBe(base);
    expect(
      buildEmbeddableText(product({ categoryPath: ["Groceries"] })).contentHash,
    ).not.toBe(base);
    expect(
      buildEmbeddableText(product({ attributes: { origin: "Naogaon" } }))
        .contentHash,
    ).not.toBe(base);
    expect(
      buildEmbeddableText(product({ skus: ["RICE-10KG"] })).contentHash,
    ).not.toBe(base);
  });

  it("carries no price, stock or discount", () => {
    // Volatile commerce data is answered from the live row, never indexed.
    // Anything typed into this function that is not read is proof of that.
    const { text } = buildEmbeddableText({
      ...product(),
      // @ts-expect-error — the type has no price field, which is the point.
      basePrice: "180.00",
    });

    expect(text).not.toContain("180");
  });

  it("copes with an uncategorised, undescribed product", () => {
    const { text, contentHash } = buildEmbeddableText(
      product({
        description: null,
        categoryPath: [],
        attributes: null,
        skus: [],
      }),
    );

    expect(text).toBe("name: Premium Basmati Rice");
    expect(contentHash).toHaveLength(64);
  });
});
