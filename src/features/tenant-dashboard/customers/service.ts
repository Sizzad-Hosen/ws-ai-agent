import "server-only";

import { toAmount } from "@/features/tenant-dashboard/money";
import type { Paginated } from "@/features/tenant-dashboard/query";
import type {
  CustomerStatusValue,
  OrderStatusValue,
} from "@/features/tenant-dashboard/status";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type { AddressInput, CustomerInput } from "./schemas";

/**
 * Customers and their delivery addresses, in one tenant's database.
 *
 * Every function takes the client the guard resolved, so there is no tenant
 * argument to forget and no filter to get wrong — the connection is the scope.
 */

export interface CustomerRow {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: CustomerStatusValue;
  readonly orderCount: number;
  readonly addressCount: number;
  readonly createdAt: string;
}

export interface AddressRow {
  readonly id: string;
  readonly label: string | null;
  readonly recipientName: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly isDefault: boolean;
}

export interface CustomerOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatusValue;
  readonly total: string;
  readonly placedAt: string;
}

export interface CustomerDetail extends CustomerRow {
  readonly addresses: readonly AddressRow[];
  readonly orders: readonly CustomerOrderSummary[];
}

export interface CustomerListQuery {
  readonly search?: string;
  readonly status?: CustomerStatusValue;
  readonly limit: number;
  readonly offset: number;
}

export async function listCustomers(
  db: TenantPrismaClient,
  query: CustomerListQuery,
): Promise<Paginated<CustomerRow>> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
            { phone: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      skip: query.offset,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true, addresses: true } } },
    }),
    db.customer.count({ where }),
  ]);

  return {
    items: rows.map(toRow),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Recent orders shown on a customer's page. */
const ORDER_HISTORY_LIMIT = 10;

export async function findCustomer(
  db: TenantPrismaClient,
  id: string,
): Promise<CustomerDetail | null> {
  const row = await db.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true, addresses: true } },
      addresses: { orderBy: [{ isDefault: "desc" }, { city: "asc" }] },
      orders: {
        take: ORDER_HISTORY_LIMIT,
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...toRow(row),
    addresses: row.addresses.map(toAddressRow),
    orders: row.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: toAmount(order.total),
      placedAt: order.placedAt.toISOString(),
    })),
  };
}

export interface CustomerOption {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly addresses: readonly {
    readonly id: string;
    readonly summary: string;
    readonly isDefault: boolean;
  }[];
}

/**
 * Customers with their addresses, for the order form.
 *
 * Both come back together because the form's address picker depends on the
 * chosen customer, and a round trip per selection would make it feel broken.
 * Blocked customers are omitted: blocking is what a tenant does to stop taking
 * their orders. `alsoInclude` brings back the one an order being edited is
 * already against, because a picker missing the value it holds would silently
 * detach the order from its buyer.
 */
export async function listCustomerOptions(
  db: TenantPrismaClient,
  alsoInclude: readonly string[] = [],
): Promise<readonly CustomerOption[]> {
  const rows = await db.customer.findMany({
    where:
      alsoInclude.length > 0
        ? {
            OR: [
              { status: "ACTIVE" as const },
              { id: { in: [...alsoInclude] } },
            ],
          }
        : { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { city: "asc" }],
        select: {
          id: true,
          label: true,
          city: true,
          addressLine: true,
          isDefault: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    addresses: row.addresses.map((address) => ({
      id: address.id,
      summary: `${address.label ? `${address.label} — ` : ""}${address.addressLine}, ${address.city}`,
      isDefault: address.isDefault,
    })),
  }));
}

export type CustomerWriteOutcome =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly reason: "not-found" };

export async function createCustomer(
  db: TenantPrismaClient,
  input: CustomerInput,
): Promise<CustomerWriteOutcome> {
  const created = await db.customer.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      status: input.status,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export async function updateCustomer(
  db: TenantPrismaClient,
  id: string,
  input: CustomerInput,
): Promise<CustomerWriteOutcome> {
  const updated = await db.customer.updateMany({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      status: input.status,
    },
  });

  return updated.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true, id };
}

export type CustomerDeleteOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-found" | "has-orders" };

/**
 * Deletes a customer, with their addresses.
 *
 * Refused once they have ordered. The order's customer column is nullable, so
 * the database would happily orphan the order instead — quietly detaching a
 * sale from the person who made it. Blocking is how a customer is stopped.
 */
export async function deleteCustomer(
  db: TenantPrismaClient,
  id: string,
): Promise<CustomerDeleteOutcome> {
  const existing = await db.customer.findUnique({
    where: { id },
    select: { _count: { select: { orders: true } } },
  });

  if (!existing) return { ok: false, reason: "not-found" };
  if (existing._count.orders > 0) return { ok: false, reason: "has-orders" };

  await db.customer.delete({ where: { id } });

  return { ok: true };
}

export async function setCustomerStatus(
  db: TenantPrismaClient,
  id: string,
  status: CustomerStatusValue,
): Promise<CustomerDeleteOutcome> {
  const updated = await db.customer.updateMany({
    where: { id },
    data: { status },
  });

  return updated.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true };
}

// ----------------------------------------------------------------- addresses

export async function createAddress(
  db: TenantPrismaClient,
  customerId: string,
  input: AddressInput,
): Promise<CustomerWriteOutcome> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { _count: { select: { addresses: true } } },
  });

  if (!customer) return { ok: false, reason: "not-found" };

  // The first address is the default whether or not the box was ticked: an
  // order picker with no default and one address to choose from is friction.
  const isDefault = input.isDefault || customer._count.addresses === 0;

  const created = await db.$transaction(async (tx) => {
    if (isDefault) await clearDefault(tx, customerId, null);

    return tx.address.create({
      data: {
        customerId,
        label: input.label,
        recipientName: input.recipientName,
        phone: input.phone,
        addressLine: input.addressLine,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        isDefault,
      },
      select: { id: true },
    });
  });

  return { ok: true, id: created.id };
}

export async function updateAddress(
  db: TenantPrismaClient,
  customerId: string,
  addressId: string,
  input: AddressInput,
): Promise<CustomerWriteOutcome> {
  // Matched on both ids: an address id belonging to another customer is not
  // this customer's row to edit, even inside the right database.
  const existing = await db.address.findFirst({
    where: { id: addressId, customerId },
    select: { id: true },
  });

  if (!existing) return { ok: false, reason: "not-found" };

  await db.$transaction(async (tx) => {
    if (input.isDefault) await clearDefault(tx, customerId, addressId);

    await tx.address.update({
      where: { id: addressId },
      data: {
        label: input.label,
        recipientName: input.recipientName,
        phone: input.phone,
        addressLine: input.addressLine,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        isDefault: input.isDefault,
      },
    });
  });

  return { ok: true, id: addressId };
}

export async function deleteAddress(
  db: TenantPrismaClient,
  customerId: string,
  addressId: string,
): Promise<CustomerDeleteOutcome> {
  const deleted = await db.address.deleteMany({
    where: { id: addressId, customerId },
  });

  return deleted.count === 0
    ? { ok: false, reason: "not-found" }
    : { ok: true };
}

/**
 * Only one address per customer is the default.
 *
 * There is no partial unique index expressing that in the schema, so it is
 * held here — inside the same transaction as the write that sets it, or a
 * failure between the two statements would leave two defaults behind.
 */
async function clearDefault(
  tx: Pick<TenantPrismaClient, "address">,
  customerId: string,
  exceptId: string | null,
): Promise<void> {
  await tx.address.updateMany({
    where: {
      customerId,
      isDefault: true,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

interface CustomerRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: CustomerStatusValue;
  readonly createdAt: Date;
  readonly _count: { orders: number; addresses: number };
}

function toRow(row: CustomerRecord): CustomerRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    orderCount: row._count.orders,
    addressCount: row._count.addresses,
    createdAt: row.createdAt.toISOString(),
  };
}

interface AddressRecord {
  readonly id: string;
  readonly label: string | null;
  readonly recipientName: string;
  readonly phone: string;
  readonly addressLine: string;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly isDefault: boolean;
}

function toAddressRow(row: AddressRecord): AddressRow {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipientName,
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    isDefault: row.isDefault,
  };
}
