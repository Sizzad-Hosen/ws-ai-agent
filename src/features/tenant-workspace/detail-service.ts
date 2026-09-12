import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type {
  TenantCustomerStatus,
  TenantOrderStatus,
  TenantProductStatus,
} from "./status";

/**
 * Detail reads for the tenant workspace.
 *
 * Each returns null for a row that does not exist, so the page can answer 404
 * rather than render half a screen. As everywhere else here the connection is
 * the tenant boundary, so an id belonging to another workspace simply is not
 * found — there is no ownership check to write, and none to forget.
 *
 * Decimal and BigInt are converted to strings and numbers at this edge. Both
 * are fine on the server and neither survives the boundary into a Client
 * Component, so converting here keeps that failure out of the pages.
 */

// ---------------------------------------------------------------- product

export interface VariantDetail {
  readonly id: string;
  readonly sku: string;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly isActive: boolean;
  readonly quantity: number | null;
  readonly reservedQuantity: number | null;
  readonly reorderLevel: number | null;
  readonly orderedCount: number;
}

export interface ProductDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: TenantProductStatus;
  readonly basePrice: string;
  readonly compareAtPrice: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly variants: readonly VariantDetail[];
  /** Order lines across every variant; zero means the product may be deleted. */
  readonly orderedCount: number;
}

export async function getProduct(
  db: TenantPrismaClient,
  productId: string,
): Promise<ProductDetail | null> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      basePrice: true,
      compareAtPrice: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      variants: {
        orderBy: { sku: "asc" },
        select: {
          id: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          isActive: true,
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
              reorderLevel: true,
            },
          },
          _count: { select: { orderItems: true } },
        },
      },
    },
  });

  if (!product) return null;

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    price: variant.price.toString(),
    compareAtPrice: variant.compareAtPrice?.toString() ?? null,
    isActive: variant.isActive,
    quantity: variant.inventory?.quantity ?? null,
    reservedQuantity: variant.inventory?.reservedQuantity ?? null,
    reorderLevel: variant.inventory?.reorderLevel ?? null,
    orderedCount: variant._count.orderItems,
  }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    basePrice: product.basePrice.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants,
    orderedCount: variants.reduce(
      (sum, variant) => sum + variant.orderedCount,
      0,
    ),
  };
}

// --------------------------------------------------------------- category

export interface CategoryDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly isActive: boolean;
  readonly productCount: number;
  readonly childCount: number;
}

export async function getCategory(
  db: TenantPrismaClient,
  categoryId: string,
): Promise<CategoryDetail | null> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      isActive: true,
      _count: { select: { products: true, children: true } },
    },
  });

  if (!category) return null;

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    isActive: category.isActive,
    productCount: category._count.products,
    childCount: category._count.children,
  };
}

export interface CategoryOption {
  readonly id: string;
  readonly name: string;
}

/** Every category, for the parent picker and the product form. */
export async function listCategoryOptions(
  db: TenantPrismaClient,
): Promise<readonly CategoryOption[]> {
  return db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// --------------------------------------------------------------- customer

export interface CustomerAddress {
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
  readonly status: TenantOrderStatus;
  readonly total: string;
  readonly placedAt: string;
}

export interface CustomerContact {
  readonly id: string;
  readonly phoneNumber: string;
  readonly displayPhoneNumber: string | null;
  readonly status: string;
  readonly conversations: number;
}

export interface CustomerDetail {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly status: TenantCustomerStatus;
  readonly createdAt: string;
  readonly addresses: readonly CustomerAddress[];
  readonly orders: readonly CustomerOrderSummary[];
  readonly contacts: readonly CustomerContact[];
  readonly orderCount: number;
  /** Across delivered, shipped, confirmed and processing orders. */
  readonly lifetimeValue: string;
}

/** Statuses that represent money earned, matching the dashboard's definition. */
const REVENUE_STATUSES = [
  "DELIVERED",
  "SHIPPED",
  "CONFIRMED",
  "PROCESSING",
] as const;

export async function getCustomer(
  db: TenantPrismaClient,
  customerId: string,
): Promise<CustomerDetail | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { city: "asc" }],
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          addressLine: true,
          city: true,
          region: true,
          postalCode: true,
          isDefault: true,
        },
      },
      orders: {
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          placedAt: true,
        },
      },
      contacts: {
        select: {
          id: true,
          phoneNumber: true,
          displayPhoneNumber: true,
          status: true,
          _count: { select: { conversations: true } },
        },
      },
    },
  });

  if (!customer) return null;

  const earned = customer.orders.filter((order) =>
    REVENUE_STATUSES.includes(
      order.status as (typeof REVENUE_STATUSES)[number],
    ),
  );

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    createdAt: customer.createdAt.toISOString(),
    addresses: customer.addresses,
    orders: customer.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toString(),
      placedAt: order.placedAt.toISOString(),
    })),
    contacts: customer.contacts.map((contact) => ({
      id: contact.id,
      phoneNumber: contact.phoneNumber,
      displayPhoneNumber: contact.displayPhoneNumber,
      status: contact.status,
      conversations: contact._count.conversations,
    })),
    orderCount: customer.orders.length,
    lifetimeValue: earned
      .reduce((sum, order) => sum + Number(order.total), 0)
      .toFixed(2),
  };
}

// ------------------------------------------------------------------ order

export interface OrderLine {
  readonly id: string;
  readonly productName: string;
  readonly sku: string;
  readonly unitPrice: string;
  readonly quantity: number;
  readonly total: string;
  /** Null when the variant has since been removed. */
  readonly productId: string | null;
}

export interface OrderPaymentRow {
  readonly id: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly status: string;
  readonly paidAt: string | null;
}

export interface OrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: TenantOrderStatus;
  readonly subtotal: string;
  readonly discount: string;
  readonly shippingFee: string;
  readonly tax: string;
  readonly total: string;
  readonly placedAt: string;
  readonly updatedAt: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly shippingAddress: CustomerAddress | null;
  readonly items: readonly OrderLine[];
  readonly payments: readonly OrderPaymentRow[];
}

export async function getOrder(
  db: TenantPrismaClient,
  orderId: string,
): Promise<OrderDetail | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      tax: true,
      total: true,
      placedAt: true,
      updatedAt: true,
      customerId: true,
      customer: { select: { name: true, email: true, phone: true } },
      shippingAddress: {
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          addressLine: true,
          city: true,
          region: true,
          postalCode: true,
          isDefault: true,
        },
      },
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          unitPrice: true,
          quantity: true,
          total: true,
          variant: { select: { productId: true } },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          providerReference: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal.toString(),
    discount: order.discount.toString(),
    shippingFee: order.shippingFee.toString(),
    tax: order.tax.toString(),
    total: order.total.toString(),
    placedAt: order.placedAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customerId: order.customerId,
    customerName: order.customer?.name ?? null,
    customerEmail: order.customer?.email ?? null,
    customerPhone: order.customer?.phone ?? null,
    shippingAddress: order.shippingAddress,
    // The snapshots are read rather than the live variant: a line must keep
    // saying what was bought even after the product is renamed.
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productNameSnapshot,
      sku: item.skuSnapshot,
      unitPrice: item.unitPrice.toString(),
      quantity: item.quantity,
      total: item.total.toString(),
      productId: item.variant?.productId ?? null,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.providerReference,
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
  };
}
