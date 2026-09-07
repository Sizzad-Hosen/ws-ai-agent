import "server-only";

import {
  fromCents,
  toAmount,
  toCents,
} from "@/features/tenant-dashboard/money";
import type { Paginated } from "@/features/tenant-dashboard/query";
import type {
  OrderStatusValue,
  PaymentStatusValue,
} from "@/features/tenant-dashboard/status";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type { OrderInput, OrderItemInput } from "./schemas";

/**
 * Orders, in one tenant's database.
 *
 * Every function takes the client the guard resolved, so there is no tenant
 * argument to forget and no filter to get wrong — the connection is the scope.
 *
 * Money is never taken from the client. Line prices are read from the variant
 * and snapshotted onto the line, and the totals are derived from those — so a
 * tampered form can change what was ordered, but not what it cost.
 */

export interface OrderRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly status: OrderStatusValue;
  readonly subtotal: string;
  readonly discount: string;
  readonly shippingFee: string;
  readonly tax: string;
  readonly total: string;
  readonly itemCount: number;
  readonly placedAt: string;
}

export interface OrderItemRow {
  readonly id: string;
  readonly productVariantId: string;
  readonly productName: string;
  readonly sku: string;
  readonly unitPrice: string;
  readonly quantity: number;
  readonly total: string;
}

export interface OrderPaymentRow {
  readonly id: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly status: PaymentStatusValue;
  readonly paidAt: string | null;
}

export interface OrderDetail extends OrderRow {
  readonly shippingAddressId: string | null;
  readonly shippingAddress: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly items: readonly OrderItemRow[];
  readonly payments: readonly OrderPaymentRow[];
  readonly updatedAt: string;
}

export interface OrderListQuery {
  readonly search?: string;
  readonly status?: OrderStatusValue;
  readonly customerId?: string;
  readonly limit: number;
  readonly offset: number;
}

export async function listOrders(
  db: TenantPrismaClient,
  query: OrderListQuery,
): Promise<Paginated<OrderRow>> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.search
      ? {
          OR: [
            {
              orderNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              customer: {
                name: { contains: query.search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      skip: query.offset,
      take: query.limit,
      orderBy: { placedAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return {
    items: rows.map(toRow),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function findOrder(
  db: TenantPrismaClient,
  id: string,
): Promise<OrderDetail | null> {
  const row = await db.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      shippingAddress: true,
      _count: { select: { items: true } },
      items: { orderBy: { productNameSnapshot: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!row) return null;

  return {
    ...toRow(row),
    shippingAddressId: row.shippingAddressId,
    shippingAddress: row.shippingAddress
      ? [
          row.shippingAddress.recipientName,
          row.shippingAddress.addressLine,
          row.shippingAddress.city,
          row.shippingAddress.region,
          row.shippingAddress.postalCode,
        ]
          .filter(Boolean)
          .join(", ")
      : null,
    customerEmail: row.customer?.email ?? null,
    customerPhone: row.customer?.phone ?? null,
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      unitPrice: toAmount(item.unitPrice),
      quantity: item.quantity,
      total: toAmount(item.total),
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.providerReference,
      amount: toAmount(payment.amount),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
  };
}

export type OrderWriteOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: OrderWriteFailure };

export type OrderWriteFailure =
  | "not-found"
  | "unknown-customer"
  | "unknown-variant"
  | "address-mismatch"
  | "discount-too-large"
  | "number-collision";

export async function createOrder(
  db: TenantPrismaClient,
  input: OrderInput,
): Promise<OrderWriteOutcome> {
  const priced = await priceOrder(db, input);

  if (!priced.ok) return priced;

  // Retried, because the number carries a random suffix and two orders placed
  // in the same millisecond could draw the same one.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await db.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: input.customerId ?? null,
          shippingAddressId: input.shippingAddressId ?? null,
          status: input.status,
          subtotal: priced.totals.subtotal,
          discount: priced.totals.discount,
          shippingFee: priced.totals.shippingFee,
          tax: priced.totals.tax,
          total: priced.totals.total,
          items: { create: [...priced.lines] },
        },
        select: { id: true },
      });

      return { ok: true, id: created.id };
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  return { ok: false, reason: "number-collision" };
}

/**
 * Rewrites an order, lines included.
 *
 * The lines are replaced rather than reconciled: an edit is rare, the set is
 * small, and matching them up would be more code than it saves. One
 * transaction, so an order is never left holding half of an edit.
 *
 * A replaced line takes its reviews' `order_item_id` with it (the relation is
 * SetNull), so a review can lose its verified-purchase link. That is the cost
 * of editing a line that has already been reviewed, and it is quieter than
 * refusing the edit.
 */
export async function updateOrder(
  db: TenantPrismaClient,
  id: string,
  input: OrderInput,
): Promise<OrderWriteOutcome> {
  const existing = await db.order.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  const priced = await priceOrder(db, input);

  if (!priced.ok) return priced;

  await db.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.order.update({
      where: { id },
      data: {
        customerId: input.customerId ?? null,
        shippingAddressId: input.shippingAddressId ?? null,
        status: input.status,
        subtotal: priced.totals.subtotal,
        discount: priced.totals.discount,
        shippingFee: priced.totals.shippingFee,
        tax: priced.totals.tax,
        total: priced.totals.total,
        items: { create: [...priced.lines] },
      },
    });
  });

  return { ok: true, id };
}

export type OrderDeleteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-found" | "has-payments" };

/**
 * Deletes an order, with its lines and payment records.
 *
 * Refused once a payment has moved: money that was taken has to stay
 * accounted for, and cancelling or refunding is how such an order is undone.
 */
export async function deleteOrder(
  db: TenantPrismaClient,
  id: string,
): Promise<OrderDeleteOutcome> {
  const existing = await db.order.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  const settled = await db.orderPayment.count({
    where: { orderId: id, status: { in: ["AUTHORIZED", "PAID", "REFUNDED"] } },
  });

  if (settled > 0) return { ok: false, reason: "has-payments" };

  await db.order.delete({ where: { id } });

  return { ok: true };
}

export async function setOrderStatus(
  db: TenantPrismaClient,
  id: string,
  status: OrderStatusValue,
): Promise<OrderDeleteOutcome> {
  const updated = await db.order.updateMany({
    where: { id },
    data: { status },
  });

  return updated.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true };
}

interface OrderTotals {
  readonly subtotal: string;
  readonly discount: string;
  readonly shippingFee: string;
  readonly tax: string;
  readonly total: string;
}

interface OrderLine {
  readonly productVariantId: string;
  readonly productNameSnapshot: string;
  readonly skuSnapshot: string;
  readonly unitPrice: string;
  readonly quantity: number;
  readonly total: string;
}

type PricedOrder =
  | {
      readonly ok: true;
      readonly totals: OrderTotals;
      readonly lines: readonly OrderLine[];
    }
  | { readonly ok: false; readonly reason: OrderWriteFailure };

/**
 * Turns "these variants, these quantities" into priced lines and totals.
 *
 * Shared by create and update so both arrive at the same figures, and so the
 * one place that reads a price is the one place that has to be trusted.
 */
async function priceOrder(
  db: TenantPrismaClient,
  input: OrderInput,
): Promise<PricedOrder> {
  if (input.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });

    if (!customer) return { ok: false, reason: "unknown-customer" };
  }

  if (input.shippingAddressId) {
    // An address must belong to the order's customer. Without this an order
    // could be shipped to an address the buyer has never seen.
    const address = await db.address.findFirst({
      where: {
        id: input.shippingAddressId,
        ...(input.customerId ? { customerId: input.customerId } : {}),
      },
      select: { id: true },
    });

    if (!address) return { ok: false, reason: "address-mismatch" };
  }

  const merged = mergeLines(input.items);
  const variantIds = merged.map((item) => item.productVariantId);

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      price: true,
      product: { select: { name: true } },
    },
  });

  if (variants.length !== variantIds.length) {
    return { ok: false, reason: "unknown-variant" };
  }

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const lines: OrderLine[] = [];
  let subtotalCents = 0;

  for (const item of merged) {
    const variant = byId.get(item.productVariantId);
    if (!variant) return { ok: false, reason: "unknown-variant" };

    const unitCents = toCents(variant.price.toString());
    const lineCents = unitCents * item.quantity;
    subtotalCents += lineCents;

    lines.push({
      productVariantId: variant.id,
      productNameSnapshot: variant.product.name,
      skuSnapshot: variant.sku,
      unitPrice: fromCents(unitCents),
      quantity: item.quantity,
      total: fromCents(lineCents),
    });
  }

  const discountCents = toCents(input.discount);
  const shippingCents = toCents(input.shippingFee);
  const taxCents = toCents(input.tax);

  // A discount larger than the goods would make a negative total, which no
  // payment provider and no report can make sense of.
  if (discountCents > subtotalCents) {
    return { ok: false, reason: "discount-too-large" };
  }

  return {
    ok: true,
    lines,
    totals: {
      subtotal: fromCents(subtotalCents),
      discount: fromCents(discountCents),
      shippingFee: fromCents(shippingCents),
      tax: fromCents(taxCents),
      total: fromCents(
        subtotalCents - discountCents + shippingCents + taxCents,
      ),
    },
  };
}

/** The same variant twice is one line of two, not two lines of one. */
function mergeLines(
  items: readonly OrderItemInput[],
): readonly OrderItemInput[] {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(
      item.productVariantId,
      (quantities.get(item.productVariantId) ?? 0) + item.quantity,
    );
  }

  return [...quantities.entries()].map(([productVariantId, quantity]) => ({
    productVariantId,
    quantity,
  }));
}

/**
 * `ORD-20260907-4F2A`: a date an owner can read, and a random suffix.
 *
 * Not a counter. A sequence would need a table of its own or a lock, and would
 * tell anyone holding one order number how many orders the store has taken.
 */
function generateOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");

  return `ORD-${day}-${suffix}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

interface OrderRecord {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerId: string | null;
  readonly status: OrderStatusValue;
  readonly subtotal: { toString(): string };
  readonly discount: { toString(): string };
  readonly shippingFee: { toString(): string };
  readonly tax: { toString(): string };
  readonly total: { toString(): string };
  readonly placedAt: Date;
  readonly customer: { name: string } | null;
  readonly _count: { items: number };
}

function toRow(row: OrderRecord): OrderRow {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customer?.name ?? null,
    status: row.status,
    subtotal: toAmount(row.subtotal),
    discount: toAmount(row.discount),
    shippingFee: toAmount(row.shippingFee),
    tax: toAmount(row.tax),
    total: toAmount(row.total),
    itemCount: row._count.items,
    placedAt: row.placedAt.toISOString(),
  };
}
