import "server-only";

import { toAmount } from "@/features/tenant-dashboard/money";
import type { Paginated } from "@/features/tenant-dashboard/query";
import type { ProductStatusValue } from "@/features/tenant-dashboard/status";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type { ProductInput, VariantInput } from "./schemas";

/**
 * The catalogue, in one tenant's database.
 *
 * Every function takes the client the guard resolved, so there is no tenant
 * argument to forget and no filter to get wrong — the connection is the scope.
 */

export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly status: ProductStatusValue;
  readonly basePrice: string;
  readonly compareAtPrice: string | null;
  readonly variantCount: number;
  readonly createdAt: string;
}

export interface VariantRow {
  readonly id: string;
  readonly sku: string;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly isActive: boolean;
  readonly quantity: number;
  readonly reservedQuantity: number;
  readonly reorderLevel: number | null;
  /** Ordered lines pointing at this variant; one is enough to block a delete. */
  readonly orderedCount: number;
}

export interface ProductDetail extends ProductRow {
  readonly variants: readonly VariantRow[];
}

export interface ProductListQuery {
  readonly search?: string;
  readonly status?: ProductStatusValue;
  readonly categoryId?: string;
  readonly limit: number;
  readonly offset: number;
}

export async function listProducts(
  db: TenantPrismaClient,
  query: ProductListQuery,
): Promise<Paginated<ProductRow>> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { slug: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      skip: query.offset,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        _count: { select: { variants: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  return {
    items: rows.map(toRow),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function findProduct(
  db: TenantPrismaClient,
  id: string,
): Promise<ProductDetail | null> {
  const row = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      _count: { select: { variants: true } },
      variants: {
        orderBy: { sku: "asc" },
        include: {
          inventory: true,
          _count: { select: { orderItems: true } },
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...toRow(row),
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: toAmount(variant.price),
      compareAtPrice: variant.compareAtPrice
        ? toAmount(variant.compareAtPrice)
        : null,
      isActive: variant.isActive,
      quantity: variant.inventory?.quantity ?? 0,
      reservedQuantity: variant.inventory?.reservedQuantity ?? 0,
      reorderLevel: variant.inventory?.reorderLevel ?? null,
      orderedCount: variant._count.orderItems,
    })),
  };
}

export interface VariantOption {
  readonly id: string;
  readonly sku: string;
  readonly productName: string;
  readonly price: string;
  readonly available: number;
}

/**
 * Sellable variants, for the order form's line picker.
 *
 * Archived products and deactivated variants are left out: an order screen
 * that offers them invites lines nobody can fulfil. `alsoInclude` brings back
 * the ones an order being edited already references, because a picker missing
 * the value it holds would blank a line the owner never touched.
 */
export async function listVariantOptions(
  db: TenantPrismaClient,
  alsoInclude: readonly string[] = [],
): Promise<readonly VariantOption[]> {
  const sellable = {
    isActive: true,
    product: { status: { not: "ARCHIVED" as const } },
  };

  const rows = await db.productVariant.findMany({
    where:
      alsoInclude.length > 0
        ? { OR: [sellable, { id: { in: [...alsoInclude] } }] }
        : sellable,
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      price: true,
      product: { select: { name: true } },
      inventory: { select: { quantity: true, reservedQuantity: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    productName: row.product.name,
    price: toAmount(row.price),
    available:
      (row.inventory?.quantity ?? 0) - (row.inventory?.reservedQuantity ?? 0),
  }));
}

export type ProductWriteOutcome =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly reason: "duplicate-slug" | "duplicate-sku" | "not-found";
    };

/**
 * Creates a product and its first variant.
 *
 * The variant is not optional. Nothing in this schema can be sold without one
 * — the price a customer pays, the SKU and the stock are all columns on
 * `product_variants`, and an order line cannot reference anything else — so a
 * product created on its own is a row that looks finished and can never be
 * ordered. It priced itself at `basePrice` because that is the number the
 * owner just typed, and it carries whatever opening stock they gave.
 */
export async function createProduct(
  db: TenantPrismaClient,
  input: ProductInput,
): Promise<ProductWriteOutcome> {
  if (await slugTaken(db, input.slug, null)) {
    return { ok: false, reason: "duplicate-slug" };
  }

  const sku = input.openingSku ?? defaultSku(input.slug);

  if (await skuTaken(db, sku, null)) {
    return { ok: false, reason: "duplicate-sku" };
  }

  const created = await db.product.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      categoryId: input.categoryId ?? null,
      status: input.status,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice,
      variants: {
        create: {
          sku,
          price: input.basePrice,
          compareAtPrice: input.compareAtPrice,
          isActive: true,
          inventory: { create: { quantity: input.openingStock } },
        },
      },
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

/**
 * Adds the missing first variant to a product that has none.
 *
 * For products created before the two were made inseparable, and for anything
 * imported straight into the tables. Priced from `basePrice`, like a product
 * created today. Refused when the product already has a variant, so it cannot
 * quietly duplicate one.
 */
export async function addDefaultVariant(
  db: TenantPrismaClient,
  productId: string,
  quantity = 0,
): Promise<ProductWriteOutcome> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      slug: true,
      basePrice: true,
      compareAtPrice: true,
      _count: { select: { variants: true } },
    },
  });

  if (!product) return { ok: false, reason: "not-found" };
  if (product._count.variants > 0) {
    return { ok: false, reason: "duplicate-sku" };
  }

  const sku = defaultSku(product.slug);

  if (await skuTaken(db, sku, null)) {
    return { ok: false, reason: "duplicate-sku" };
  }

  const created = await db.productVariant.create({
    data: {
      productId,
      sku,
      price: product.basePrice,
      compareAtPrice: product.compareAtPrice,
      isActive: true,
      inventory: { create: { quantity } },
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

/** A SKU derived from the slug, for the variant an owner did not name. */
function defaultSku(slug: string): string {
  return slug
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .toUpperCase()
    .slice(0, 100);
}

export async function updateProduct(
  db: TenantPrismaClient,
  id: string,
  input: ProductInput,
): Promise<ProductWriteOutcome> {
  const existing = await db.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  if (await slugTaken(db, input.slug, id)) {
    return { ok: false, reason: "duplicate-slug" };
  }

  await db.product.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      categoryId: input.categoryId ?? null,
      status: input.status,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice,
    },
  });

  return { ok: true, id };
}

export type ProductDeleteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-found" | "has-orders" };

/**
 * Deletes a product, with its variants and inventory.
 *
 * Refused once any variant has been ordered. `order_items` restricts the
 * variant relation, so Postgres would refuse anyway — but it would refuse as a
 * constraint violation, which reads as a bug rather than as the rule it is: a
 * sold line keeps its snapshot, and archiving is how a product retires.
 */
export async function deleteProduct(
  db: TenantPrismaClient,
  id: string,
): Promise<ProductDeleteOutcome> {
  const existing = await db.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  const ordered = await db.orderItem.count({
    where: { variant: { productId: id } },
  });

  if (ordered > 0) return { ok: false, reason: "has-orders" };

  await db.product.delete({ where: { id } });

  return { ok: true };
}

export async function setProductStatus(
  db: TenantPrismaClient,
  id: string,
  status: ProductStatusValue,
): Promise<ProductDeleteOutcome> {
  const updated = await db.product.updateMany({
    where: { id },
    data: { status },
  });

  return updated.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true };
}

// ------------------------------------------------------------------ variants

export async function createVariant(
  db: TenantPrismaClient,
  productId: string,
  input: VariantInput,
): Promise<ProductWriteOutcome> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) return { ok: false, reason: "not-found" };

  if (await skuTaken(db, input.sku, null)) {
    return { ok: false, reason: "duplicate-sku" };
  }

  // Nested write, so a variant never exists without the inventory row every
  // stock reading assumes is there.
  const created = await db.productVariant.create({
    data: {
      productId,
      sku: input.sku,
      price: input.price,
      compareAtPrice: input.compareAtPrice,
      isActive: input.isActive,
      inventory: {
        create: {
          quantity: input.quantity,
          reorderLevel: input.reorderLevel,
        },
      },
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export async function updateVariant(
  db: TenantPrismaClient,
  productId: string,
  variantId: string,
  input: VariantInput,
): Promise<ProductWriteOutcome> {
  // Matched on both ids: a variant id that belongs to a different product is
  // not this product's row to edit, even inside the right database.
  const existing = await db.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  if (await skuTaken(db, input.sku, variantId)) {
    return { ok: false, reason: "duplicate-sku" };
  }

  await db.productVariant.update({
    where: { id: variantId },
    data: {
      sku: input.sku,
      price: input.price,
      compareAtPrice: input.compareAtPrice,
      isActive: input.isActive,
      // Upsert rather than update: a variant provisioned before this screen
      // existed may have no inventory row yet.
      inventory: {
        upsert: {
          create: {
            quantity: input.quantity,
            reorderLevel: input.reorderLevel,
          },
          update: {
            quantity: input.quantity,
            reorderLevel: input.reorderLevel,
          },
        },
      },
    },
  });

  return { ok: true, id: variantId };
}

export async function deleteVariant(
  db: TenantPrismaClient,
  productId: string,
  variantId: string,
): Promise<ProductDeleteOutcome> {
  const existing = await db.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { _count: { select: { orderItems: true } } },
  });

  if (!existing) return { ok: false, reason: "not-found" };
  if (existing._count.orderItems > 0) {
    return { ok: false, reason: "has-orders" };
  }

  await db.productVariant.delete({ where: { id: variantId } });

  return { ok: true };
}

async function slugTaken(
  db: TenantPrismaClient,
  slug: string,
  exceptId: string | null,
): Promise<boolean> {
  const existing = await db.product.findUnique({
    where: { slug },
    select: { id: true },
  });

  return existing !== null && existing.id !== exceptId;
}

async function skuTaken(
  db: TenantPrismaClient,
  sku: string,
  exceptId: string | null,
): Promise<boolean> {
  const existing = await db.productVariant.findUnique({
    where: { sku },
    select: { id: true },
  });

  return existing !== null && existing.id !== exceptId;
}

interface ProductRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly status: ProductStatusValue;
  readonly basePrice: { toString(): string };
  readonly compareAtPrice: { toString(): string } | null;
  readonly createdAt: Date;
  readonly category: { name: string } | null;
  readonly _count: { variants: number };
}

function toRow(row: ProductRecord): ProductRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    status: row.status,
    basePrice: toAmount(row.basePrice),
    compareAtPrice: row.compareAtPrice ? toAmount(row.compareAtPrice) : null,
    variantCount: row._count.variants,
    createdAt: row.createdAt.toISOString(),
  };
}
