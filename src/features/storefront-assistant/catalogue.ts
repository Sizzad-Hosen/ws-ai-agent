import "server-only";

import { toAmount } from "@/features/tenant-dashboard/money";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import { normalize } from "./language";

/**
 * The catalogue, as the storefront assistant is allowed to see it.
 *
 * Every function here takes the tenant's own client, so the isolation question
 * is answered by the connection rather than by a filter someone could forget:
 * there is no tenant column to compare, because there is no shared table. A
 * customer chatting to one shop cannot be shown another shop's products even
 * if the model asks for them by name.
 *
 * What is exposed is deliberately narrower than the dashboard's view: only
 * active products, only active variants, and stock as a number the shopper is
 * allowed to know. Cost prices, draft products and archived lines never leave.
 */

export interface StorefrontVariant {
  readonly variantId: string;
  readonly productName: string;
  readonly sku: string;
  readonly price: string;
  readonly available: number;
  readonly categoryName: string | null;
  readonly description: string | null;
}

/** Caps every catalogue read, so one question cannot pull the whole shop. */
const MAX_RESULTS = 8;

/**
 * Words that say what the customer wants *done*, not what they want.
 *
 * Ported from the reference agent's `SEARCH_STOP_WORDS`: without them "iphone
 * er dam koto" searches for a product literally named "dam", finds nothing,
 * and the shopper is told the shop does not sell it.
 */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "my",
  "me",
  "to",
  "is",
  "it",
  "for",
  "do",
  "you",
  "your",
  "have",
  "want",
  "need",
  "please",
  "check",
  "hi",
  "hello",
  "hey",
  "price",
  "cost",
  "stock",
  "order",
  "buy",
  "available",
  "much",
  "how",
  "what",
  "which",
  "any",
  "show",
  "list",
  "tell",
  "about",
  "and",
  "of",
  "in",
  "on",
  "ase",
  "ache",
  "chai",
  "korte",
  "kinbo",
  "kinte",
  "nibo",
  "dam",
  "koto",
  "koyta",
  "koyti",
  "er",
  "ta",
  "ti",
  "amar",
  "ami",
  "apnar",
  "vai",
  "bhai",
  "lagbe",
  "dorkar",
  "ki",
  "kothay",
  "hobe",
  "টি",
  "টা",
  "দাম",
  "মূল্য",
  "স্টক",
  "অর্ডার",
  "আমি",
  "আমার",
  "আপনার",
  "কাছে",
  "করতে",
  "চাই",
  "নিতে",
  "এর",
  "কত",
  "কতটি",
  "কী",
  "কি",
  "পণ্য",
  "প্রোডাক্ট",
  "আছে",
  "দেখান",
  "দেখাও",
  "কোন",
]);

/** Only what a shopper may be offered: live product, live variant. */
const SELLABLE = {
  isActive: true,
  product: { status: "ACTIVE" as const },
};

const VARIANT_SELECTION = {
  id: true,
  sku: true,
  price: true,
  product: {
    select: {
      name: true,
      description: true,
      category: { select: { name: true } },
    },
  },
  inventory: { select: { quantity: true, reservedQuantity: true } },
} as const;

interface VariantRecord {
  readonly id: string;
  readonly sku: string;
  readonly price: { toString(): string };
  readonly product: {
    readonly name: string;
    readonly description: string | null;
    readonly category: { name: string } | null;
  };
  readonly inventory: {
    readonly quantity: number;
    readonly reservedQuantity: number;
  } | null;
}

function toVariant(row: VariantRecord): StorefrontVariant {
  return {
    variantId: row.id,
    productName: row.product.name,
    sku: row.sku,
    price: toAmount(row.price),
    // Reserved stock is spoken for. Telling a shopper it is available is how
    // two people are sold the same last item.
    available: Math.max(
      0,
      (row.inventory?.quantity ?? 0) - (row.inventory?.reservedQuantity ?? 0),
    ),
    categoryName: row.product.category?.name ?? null,
    description: row.product.description,
  };
}

export async function listStorefrontVariants(
  db: TenantPrismaClient,
  limit = MAX_RESULTS,
): Promise<readonly StorefrontVariant[]> {
  const rows = await db.productVariant.findMany({
    where: SELLABLE,
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    take: limit,
    select: VARIANT_SELECTION,
  });

  return rows.map(toVariant);
}

/**
 * Finds what the customer asked for.
 *
 * Every meaningful token has to appear somewhere in the product, so "iphone
 * 15" does not return every phone in the shop. When nothing matches on all
 * tokens the search widens to any of them, because a shopper who typed one
 * word wrong should still be shown something rather than nothing.
 */
export async function searchStorefrontVariants(
  db: TenantPrismaClient,
  query: string,
  limit = MAX_RESULTS,
): Promise<readonly StorefrontVariant[]> {
  const tokens = normalize(query)
    .replace(/\b\d{1,3}\s*(?:ta|ti|টি|টা|pcs?|pieces?)\b/g, " ")
    .split(" ")
    // `\p{M}` stays: Bangla vowel signs are combining marks, and dropping
    // them mangles the very words a Bangla-speaking shopper searches with.
    .map((token) => token.replace(/[^\p{L}\p{N}\p{M}+-]/gu, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  if (tokens.length === 0) return [];

  const matches = (token: string) => ({
    OR: [
      { sku: { contains: token, mode: "insensitive" as const } },
      { product: { name: { contains: token, mode: "insensitive" as const } } },
      {
        product: {
          category: {
            name: { contains: token, mode: "insensitive" as const },
          },
        },
      },
    ],
  });

  const all = await db.productVariant.findMany({
    where: { ...SELLABLE, AND: tokens.map(matches) },
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    take: limit,
    select: VARIANT_SELECTION,
  });

  if (all.length > 0) return all.map(toVariant);

  const any = await db.productVariant.findMany({
    where: { ...SELLABLE, OR: tokens.map(matches) },
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    take: limit,
    select: VARIANT_SELECTION,
  });

  return any.map(toVariant);
}

/**
 * One variant, by id.
 *
 * Used wherever a variant id travels through the browser — the chat draft, a
 * tool argument the model produced. Re-read every time rather than trusted:
 * the id says which row, and this says what that row currently costs and how
 * many are left.
 */
export async function findStorefrontVariant(
  db: TenantPrismaClient,
  variantId: string,
): Promise<StorefrontVariant | null> {
  const row = await db.productVariant.findFirst({
    where: { id: variantId, ...SELLABLE },
    select: VARIANT_SELECTION,
  });

  return row ? toVariant(row) : null;
}

export async function countStorefrontVariants(
  db: TenantPrismaClient,
): Promise<number> {
  return db.productVariant.count({ where: SELLABLE });
}

export interface StorefrontReadiness {
  /** Everything in the catalogue, whatever its state. */
  readonly products: number;
  readonly activeProducts: number;
  readonly draftProducts: number;
  readonly archivedProducts: number;
  /** Active products with no variant at all — catalogued but unsellable. */
  readonly productsWithoutVariant: number;
  /** What a customer can actually be shown. */
  readonly sellableVariants: number;
  /** Of those, how many have nothing left on the shelf. */
  readonly outOfStock: number;
}

/**
 * Why the storefront shows what it shows.
 *
 * A shop owner who has added products and sees "no products yet" in the chat
 * has no way, from that screen, to know which of three rules excluded them.
 * This counts each one so the answer can be shown next to the assistant that
 * gave it, rather than found by reading the query.
 */
export async function storefrontReadiness(
  db: TenantPrismaClient,
): Promise<StorefrontReadiness> {
  const [products, byStatus, withoutVariant, sellable, outOfStock] =
    await Promise.all([
      db.product.count(),
      db.product.groupBy({ by: ["status"], _count: { _all: true } }),
      db.product.count({
        where: { status: "ACTIVE", variants: { none: {} } },
      }),
      db.productVariant.count({ where: SELLABLE }),
      db.productVariant.count({
        where: {
          ...SELLABLE,
          OR: [{ inventory: null }, { inventory: { quantity: { lte: 0 } } }],
        },
      }),
    ]);

  const count = (status: "ACTIVE" | "DRAFT" | "ARCHIVED") =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    products,
    activeProducts: count("ACTIVE"),
    draftProducts: count("DRAFT"),
    archivedProducts: count("ARCHIVED"),
    productsWithoutVariant: withoutVariant,
    sellableVariants: sellable,
    outOfStock,
  };
}
