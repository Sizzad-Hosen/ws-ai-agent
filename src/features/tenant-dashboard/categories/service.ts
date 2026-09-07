import "server-only";

import type { Paginated } from "@/features/tenant-dashboard/query";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type { CategoryInput } from "./schemas";

/**
 * Categories, in one tenant's database.
 *
 * Every function takes the client the guard resolved, so there is no tenant
 * argument to forget and no filter to get wrong — the connection is the scope.
 */

export interface CategoryRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly parentName: string | null;
  readonly isActive: boolean;
  readonly productCount: number;
  readonly createdAt: string;
}

export interface CategoryListQuery {
  readonly search?: string;
  readonly limit: number;
  readonly offset: number;
}

export async function listCategories(
  db: TenantPrismaClient,
  query: CategoryListQuery,
): Promise<Paginated<CategoryRow>> {
  const where = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" as const } },
          { slug: { contains: query.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.category.findMany({
      where,
      skip: query.offset,
      take: query.limit,
      orderBy: { name: "asc" },
      include: {
        parent: { select: { name: true } },
        _count: { select: { products: true } },
      },
    }),
    db.category.count({ where }),
  ]);

  return {
    items: rows.map(toRow),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function findCategory(
  db: TenantPrismaClient,
  id: string,
): Promise<CategoryRow | null> {
  const row = await db.category.findUnique({
    where: { id },
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });

  return row ? toRow(row) : null;
}

/** Every category, for a parent picker. Small by nature, so no paging. */
export async function listCategoryOptions(
  db: TenantPrismaClient,
): Promise<readonly { id: string; name: string }[]> {
  return db.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type CategoryWriteOutcome =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly reason: "duplicate-slug" | "not-found" | "cycle";
    };

export async function createCategory(
  db: TenantPrismaClient,
  input: CategoryInput,
): Promise<CategoryWriteOutcome> {
  if (await slugTaken(db, input.slug, null)) {
    return { ok: false, reason: "duplicate-slug" };
  }

  const created = await db.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      parentId: input.parentId ?? null,
      isActive: input.isActive,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export async function updateCategory(
  db: TenantPrismaClient,
  id: string,
  input: CategoryInput,
): Promise<CategoryWriteOutcome> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  if (await slugTaken(db, input.slug, id)) {
    return { ok: false, reason: "duplicate-slug" };
  }

  // A category cannot be its own ancestor: the tree would have no root, and
  // every walk over it would loop forever.
  if (input.parentId && (await wouldCycle(db, id, input.parentId))) {
    return { ok: false, reason: "cycle" };
  }

  await db.category.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      parentId: input.parentId ?? null,
      isActive: input.isActive,
    },
  });

  return { ok: true, id };
}

export type CategoryDeleteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-found" | "has-products" };

/**
 * Deletes a category.
 *
 * Refused while products reference it. The column is nullable, so the database
 * would happily blank them — silently dropping a classification nobody asked
 * to lose. Deactivating is how a category that has been used is retired.
 */
export async function deleteCategory(
  db: TenantPrismaClient,
  id: string,
): Promise<CategoryDeleteOutcome> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { _count: { select: { products: true } } },
  });

  if (!existing) return { ok: false, reason: "not-found" };
  if (existing._count.products > 0) {
    return { ok: false, reason: "has-products" };
  }

  await db.category.delete({ where: { id } });

  return { ok: true };
}

export async function setCategoryActive(
  db: TenantPrismaClient,
  id: string,
  isActive: boolean,
): Promise<CategoryDeleteOutcome> {
  const updated = await db.category.updateMany({
    where: { id },
    data: { isActive },
  });

  return updated.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true };
}

async function slugTaken(
  db: TenantPrismaClient,
  slug: string,
  exceptId: string | null,
): Promise<boolean> {
  const existing = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });

  return existing !== null && existing.id !== exceptId;
}

/** Walks up from the proposed parent looking for the category being edited. */
async function wouldCycle(
  db: TenantPrismaClient,
  id: string,
  parentId: string,
): Promise<boolean> {
  let cursor: string | null = parentId;

  // Bounded, so a tree that already contains a cycle cannot hang the request.
  for (let depth = 0; cursor !== null && depth < 50; depth += 1) {
    if (cursor === id) return true;

    const parent: { parentId: string | null } | null =
      await db.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });

    cursor = parent?.parentId ?? null;
  }

  return false;
}

interface CategoryRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly parent: { name: string } | null;
  readonly _count: { products: number };
}

function toRow(row: CategoryRecord): CategoryRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    isActive: row.isActive,
    productCount: row._count.products,
    createdAt: row.createdAt.toISOString(),
  };
}
