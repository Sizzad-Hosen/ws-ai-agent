import { createHash } from "node:crypto";

/**
 * The text a product is embedded as.
 *
 * Pure, and deliberately so: it is the one thing in this layer whose output
 * decides whether work happens at all. `contentHash` is a hash of exactly what
 * gets embedded, so an unchanged hash means an unchanged vector and no call to
 * the provider. That makes an unconditional resync of a whole catalogue nearly
 * free, which in turn makes reconciliation something you can run on a schedule
 * rather than something you avoid.
 *
 * Two rules follow from that, and both are load-bearing:
 *
 *  1. **Volatile commerce data is excluded.** Price, compare-at price, stock
 *     and discounts are not in here. They change hourly in a live shop, and
 *     including them would re-embed the catalogue every time somebody edited a
 *     price — paying a provider to write back a vector that means the same
 *     thing. They are answered from the live row by tool calls instead, which
 *     is also the only way they can be *current*: an index is by definition a
 *     snapshot.
 *  2. **The output is canonical.** Same product, same text, byte for byte,
 *     whatever order the attributes arrived in. A hash that depends on JSON key
 *     order is a hash that changes at random, and every change costs money.
 */

export interface EmbeddableProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: string;
  /** Free-form product attributes; the tenant schema keeps them as JSON. */
  readonly attributes: unknown;
  /**
   * Root-first path of category names, e.g. ["Groceries", "Rice"]. Empty for
   * an uncategorised product.
   */
  readonly categoryPath: readonly string[];
  /** SKUs of the product's active variants — what a shopper may search by. */
  readonly skus: readonly string[];
}

export interface EmbeddableText {
  readonly text: string;
  /** sha256 of `text`, hex. The whole point of the pure function. */
  readonly contentHash: string;
}

/** Keeps one product's text from growing without bound. */
const MAX_DESCRIPTION = 2000;
const MAX_ATTRIBUTE_VALUES = 40;

export function buildEmbeddableText(
  product: EmbeddableProduct,
): EmbeddableText {
  const lines: string[] = [`name: ${collapse(product.name)}`];

  if (product.categoryPath.length > 0) {
    lines.push(`category: ${product.categoryPath.map(collapse).join(" > ")}`);
  }

  if (product.description && product.description.trim() !== "") {
    lines.push(
      `description: ${collapse(product.description).slice(0, MAX_DESCRIPTION)}`,
    );
  }

  const attributes = flattenAttributes(product.attributes);

  if (attributes.length > 0) {
    lines.push(`attributes: ${attributes.join("; ")}`);
  }

  if (product.skus.length > 0) {
    // Sorted, because "which SKUs does this product have" is a set, and the
    // order rows come back in is not part of the answer.
    lines.push(`skus: ${[...product.skus].map(collapse).sort().join(", ")}`);
  }

  const text = lines.join("\n");

  return { text, contentHash: sha256(text) };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** One line, single-spaced, so whitespace edits do not change the hash. */
function collapse(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Attributes as sorted `key: value` pairs.
 *
 * Sorted by key and flattened depth-first, so `{a, b}` and `{b, a}` — the same
 * attributes, different JSON — produce the same text and therefore the same
 * hash. Nested objects and arrays are walked rather than stringified, because
 * `JSON.stringify` would put key order back into the output.
 */
function flattenAttributes(value: unknown, prefix = ""): readonly string[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((entry, index) =>
        flattenAttributes(entry, prefix === "" ? String(index) : prefix),
      )
      .slice(0, MAX_ATTRIBUTE_VALUES);
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, entry]) =>
        flattenAttributes(entry, prefix === "" ? key : `${prefix}.${key}`),
      )
      .slice(0, MAX_ATTRIBUTE_VALUES);
  }

  const rendered = collapse(String(value));

  if (rendered === "") return [];

  return [prefix === "" ? rendered : `${prefix}: ${rendered}`];
}
