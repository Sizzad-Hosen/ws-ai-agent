import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type { ListParams } from "./pagination";
import type {
  TenantCustomerSource,
  TenantCustomerStatus,
  TenantOrderStatus,
  TenantProductStatus,
  TenantUserStatus,
} from "./status";

/**
 * The tenant workspace list screens, read from that tenant's own database.
 *
 * Every function takes the connection the guard resolved. There is no tenant
 * filter in any query, and there is nothing to get wrong: the database itself
 * is the boundary, so a query issued here cannot reach another workspace.
 *
 * Search is case-insensitive `contains`, which Postgres serves with a
 * sequential scan. That is the right trade at a tenant's own catalogue size;
 * it is the wrong one at a million rows, and a trigram index is the answer
 * then rather than a different query shape now.
 */

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

async function paginate<T>(
  rows: Promise<readonly T[]>,
  total: Promise<number>,
  params: ListParams,
): Promise<Page<T>> {
  const [items, count] = await Promise.all([rows, total]);
  return { items, total: count, limit: params.limit, offset: params.offset };
}

// ------------------------------------------------------------------- users

export interface TenantUserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: TenantUserStatus;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export async function listUsers(
  db: TenantPrismaClient,
  params: ListParams,
): Promise<Page<TenantUserRow>> {
  const where = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: "insensitive" as const } },
          { email: { contains: params.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return paginate(
    db.user
      .findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          status: row.status,
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        })),
      ),
    db.user.count({ where }),
    params,
  );
}

// --------------------------------------------------------------- customers

export interface TenantCustomerRow {
  readonly id: string;
  /** Nullable now: a WhatsApp contact may never give a name. */
  readonly name: string | null;
  readonly profileName: string | null;
  readonly waId: string;
  readonly email: string | null;
  readonly phone: string;
  readonly status: TenantCustomerStatus;
  readonly source: TenantCustomerSource;
  readonly orders: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export async function listCustomers(
  db: TenantPrismaClient,
  params: ListParams,
): Promise<Page<TenantCustomerRow>> {
  const where = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: "insensitive" as const } },
          { email: { contains: params.search, mode: "insensitive" as const } },
          { phone: { contains: params.search } },
          // The WhatsApp id is how a customer is found from a message.
          { waId: { contains: params.search } },
        ],
      }
    : {};

  return paginate(
    db.customer
      .findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          name: true,
          profileName: true,
          waId: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          firstSeenAt: true,
          lastSeenAt: true,
          _count: { select: { orders: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          profileName: row.profileName,
          waId: row.waId,
          email: row.email,
          phone: row.phone,
          status: row.status,
          source: row.source,
          orders: row._count.orders,
          firstSeenAt: row.firstSeenAt.toISOString(),
          lastSeenAt: row.lastSeenAt.toISOString(),
        })),
      ),
    db.customer.count({ where }),
    params,
  );
}

// ---------------------------------------------------------------- products

export interface TenantProductRow {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly categoryName: string | null;
  readonly status: TenantProductStatus;
  readonly basePrice: string;
  readonly variants: number;
  /** Summed across variants; null when no variant carries an inventory row. */
  readonly stock: number | null;
}

export async function listProducts(
  db: TenantPrismaClient,
  params: ListParams,
): Promise<Page<TenantProductRow>> {
  // Soft-deleted products are gone from the catalogue, not merely hidden.
  const where = {
    deletedAt: null,
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { slug: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  return paginate(
    db.product
      .findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          basePrice: true,
          category: { select: { name: true } },
          variants: {
            select: {
              sku: true,
              inventory: { select: { quantity: true } },
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => {
          const tracked = row.variants.filter(
            (variant) => variant.inventory !== null,
          );

          return {
            id: row.id,
            name: row.name,
            sku: row.variants[0]?.sku ?? null,
            categoryName: row.category?.name ?? null,
            status: row.status,
            basePrice: row.basePrice.toString(),
            variants: row.variants.length,
            stock:
              tracked.length === 0
                ? null
                : tracked.reduce(
                    (sum, variant) => sum + (variant.inventory?.quantity ?? 0),
                    0,
                  ),
          };
        }),
      ),
    db.product.count({ where }),
    params,
  );
}

// -------------------------------------------------------------- categories

export interface TenantCategoryRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentName: string | null;
  readonly isActive: boolean;
  readonly products: number;
}

export async function listCategories(
  db: TenantPrismaClient,
  params: ListParams,
): Promise<Page<TenantCategoryRow>> {
  const where = params.search
    ? {
        OR: [
          { name: { contains: params.search, mode: "insensitive" as const } },
          { slug: { contains: params.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return paginate(
    db.category
      .findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          parent: { select: { name: true } },
          _count: { select: { products: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          parentName: row.parent?.name ?? null,
          isActive: row.isActive,
          products: row._count.products,
        })),
      ),
    db.category.count({ where }),
    params,
  );
}

// ------------------------------------------------------------------ orders

export interface TenantOrderRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerName: string | null;
  readonly status: TenantOrderStatus;
  readonly items: number;
  readonly total: string;
  readonly placedAt: string;
}

export async function listOrders(
  db: TenantPrismaClient,
  params: ListParams,
): Promise<Page<TenantOrderRow>> {
  const where = params.search
    ? {
        OR: [
          {
            orderNumber: {
              contains: params.search,
              mode: "insensitive" as const,
            },
          },
          {
            customer: {
              name: { contains: params.search, mode: "insensitive" as const },
            },
          },
        ],
      }
    : {};

  return paginate(
    db.order
      .findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          customerName: row.customer?.name ?? null,
          status: row.status,
          items: row._count.items,
          total: row.total.toString(),
          placedAt: row.placedAt.toISOString(),
        })),
      ),
    db.order.count({ where }),
    params,
  );
}

// ---------------------------------------------------------------- settings

export interface TenantSettingRow {
  readonly settingKey: string;
  /** Serialised for display; `value` is arbitrary JSON. */
  readonly value: string;
  readonly updatedAt: string;
}

export async function listSettings(
  db: TenantPrismaClient,
): Promise<readonly TenantSettingRow[]> {
  const rows = await db.storeSetting.findMany({
    orderBy: { settingKey: "asc" },
    select: { settingKey: true, value: true, updatedAt: true },
  });

  return rows.map((row) => ({
    settingKey: row.settingKey,
    value:
      typeof row.value === "string" ? row.value : JSON.stringify(row.value),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
