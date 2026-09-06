import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

/**
 * The tenant dashboard's figures, read from that tenant's own database.
 *
 * Every number here is a query against the connection the guard handed over,
 * so a tenant's dashboard cannot show another tenant's totals even if the
 * caller asks for them — there is no tenant filter to get wrong, because the
 * database itself is the boundary.
 */

export interface TenantDashboardStats {
  readonly totalCustomers: number;
  readonly totalUsers: number;
  readonly totalProducts: number;
  readonly totalOrders: number;
  /** Sum of delivered and paid order totals, as a decimal string. */
  readonly revenue: string;
  readonly currency: string;
  readonly recentOrders: readonly RecentOrder[];
  readonly recentActivity: readonly ActivityEntry[];
  readonly salesByDay: readonly SalesPoint[];
  readonly ordersByStatus: readonly StatusCount[];
}

export interface RecentOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerName: string | null;
  readonly status: string;
  readonly total: string;
  readonly placedAt: string;
}

export interface ActivityEntry {
  readonly id: string;
  readonly description: string;
  readonly at: string;
}

export interface SalesPoint {
  readonly day: string;
  readonly total: number;
}

export interface StatusCount {
  readonly status: string;
  readonly count: number;
}

/** Days of history the sales overview covers. */
const SALES_WINDOW_DAYS = 14;
const RECENT_LIMIT = 5;

/** Statuses that represent money actually earned, not merely ordered. */
const REVENUE_STATUSES = [
  "DELIVERED",
  "SHIPPED",
  "CONFIRMED",
  "PROCESSING",
] as const;

export async function loadTenantDashboard(
  db: TenantPrismaClient,
): Promise<TenantDashboardStats> {
  const since = new Date();
  since.setDate(since.getDate() - SALES_WINDOW_DAYS);

  // Issued together: six independent reads on one connection, and the page
  // cannot render until the slowest returns either way.
  const [
    totalCustomers,
    totalUsers,
    totalProducts,
    totalOrders,
    revenue,
    recentOrderRows,
    statusGroups,
    salesRows,
    recentCustomers,
    recentProducts,
  ] = await Promise.all([
    db.customer.count(),
    db.user.count(),
    db.product.count(),
    db.order.count(),
    db.order.aggregate({
      _sum: { total: true },
      where: { status: { in: [...REVENUE_STATUSES] } },
    }),
    db.order.findMany({
      take: RECENT_LIMIT,
      orderBy: { placedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        placedAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.findMany({
      where: { placedAt: { gte: since } },
      select: { placedAt: true, total: true },
      orderBy: { placedAt: "asc" },
    }),
    db.customer.findMany({
      take: RECENT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
    }),
    db.product.findMany({
      take: RECENT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  return {
    totalCustomers,
    totalUsers,
    totalProducts,
    totalOrders,
    revenue: (revenue._sum.total ?? 0).toString(),
    // The tenant schema records a currency per payment and per order line, not
    // per store, so there is nothing to read a store default from yet.
    currency: "USD",
    recentOrders: recentOrderRows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name ?? null,
      status: order.status,
      total: order.total.toString(),
      placedAt: order.placedAt.toISOString(),
    })),
    recentActivity: buildActivity(
      recentCustomers,
      recentProducts,
      recentOrderRows,
    ),
    salesByDay: bucketByDay(salesRows, since),
    ordersByStatus: statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
  };
}

/**
 * Recent activity, assembled from what the schema actually records.
 *
 * There is no activity or event table in the tenant ERD, so this is derived
 * from the creation timestamps that do exist rather than invented. It is
 * honest about being a digest of rows, not an audit trail.
 */
function buildActivity(
  customers: readonly { id: string; name: string; createdAt: Date }[],
  products: readonly { id: string; name: string; createdAt: Date }[],
  orders: readonly { id: string; orderNumber: string; placedAt: Date }[],
): readonly ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...customers.map((row) => ({
      id: `customer-${row.id}`,
      description: `${row.name} was added as a customer`,
      at: row.createdAt.toISOString(),
    })),
    ...products.map((row) => ({
      id: `product-${row.id}`,
      description: `${row.name} was added to the catalogue`,
      at: row.createdAt.toISOString(),
    })),
    ...orders.map((row) => ({
      id: `order-${row.id}`,
      description: `Order ${row.orderNumber} was placed`,
      at: row.placedAt.toISOString(),
    })),
  ];

  return entries
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_LIMIT * 2);
}

/** One bucket per day across the window, so gaps render as zero, not as absent. */
function bucketByDay(
  rows: readonly { placedAt: Date; total: { toString(): string } }[],
  since: Date,
): readonly SalesPoint[] {
  const buckets = new Map<string, number>();

  for (let index = 0; index <= SALES_WINDOW_DAYS; index += 1) {
    const day = new Date(since);
    day.setDate(day.getDate() + index);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = row.placedAt.toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + Number(row.total.toString()));
  }

  return [...buckets.entries()].map(([day, total]) => ({ day, total }));
}
