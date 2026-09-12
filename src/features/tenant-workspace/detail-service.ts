import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import type {
  TenantConversationState,
  TenantCustomerSource,
  TenantCustomerStatus,
  TenantOrderPaymentStatus,
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
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  /** Soft delete. A product on an order line is never actually removed. */
  readonly deletedAt: string | null;
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
      categoryId: true,
      deletedAt: true,
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
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    deletedAt: product.deletedAt?.toISOString() ?? null,
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
  readonly isDefault: boolean;
  /** The zone that sets the delivery charge, when one matched. */
  readonly deliveryZoneName: string | null;
}

export interface CustomerOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: TenantOrderStatus;
  readonly total: string;
  readonly placedAt: string;
}

export interface CustomerConversationSummary {
  readonly id: string;
  readonly state: TenantConversationState;
  readonly status: string;
  readonly aiPaused: boolean;
  readonly lastMessageAt: string | null;
  readonly messages: number;
}

export interface CustomerDetail {
  readonly id: string;
  /** Nullable: a WhatsApp contact may never give a name. */
  readonly name: string | null;
  /** The WhatsApp identity. Unique, and how an inbound message finds them. */
  readonly waId: string;
  readonly profileName: string | null;
  readonly email: string | null;
  readonly phone: string;
  readonly status: TenantCustomerStatus;
  readonly source: TenantCustomerSource;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly addresses: readonly CustomerAddress[];
  readonly orders: readonly CustomerOrderSummary[];
  readonly conversations: readonly CustomerConversationSummary[];
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
      waId: true,
      profileName: true,
      email: true,
      phone: true,
      status: true,
      source: true,
      firstSeenAt: true,
      lastSeenAt: true,
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
          isDefault: true,
          deliveryZone: { select: { name: true } },
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
      // Conversations replace the old `contacts` table: the WhatsApp identity
      // now lives on the customer, so a thread hangs off them directly.
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          state: true,
          status: true,
          aiPaused: true,
          lastMessageAt: true,
          _count: { select: { messages: true } },
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
    waId: customer.waId,
    profileName: customer.profileName,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    source: customer.source,
    firstSeenAt: customer.firstSeenAt.toISOString(),
    lastSeenAt: customer.lastSeenAt.toISOString(),
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine: address.addressLine,
      city: address.city,
      region: address.region,
      isDefault: address.isDefault,
      deliveryZoneName: address.deliveryZone?.name ?? null,
    })),
    orders: customer.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toString(),
      placedAt: order.placedAt.toISOString(),
    })),
    conversations: customer.conversations.map((conversation) => ({
      id: conversation.id,
      state: conversation.state,
      status: conversation.status,
      aiPaused: conversation.aiPaused,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      messages: conversation._count.messages,
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

export interface OrderEventRow {
  readonly id: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly actorType: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface OrderDetail {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: TenantOrderStatus;
  readonly paymentStatus: TenantOrderPaymentStatus;
  readonly source: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly deliveryCharge: string;
  readonly total: string;
  readonly placedAt: string;
  readonly updatedAt: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly conversationId: string | null;
  readonly deliveryZoneName: string | null;
  readonly shippingAddress: CustomerAddress | null;
  readonly items: readonly OrderLine[];
  readonly payments: readonly OrderPaymentRow[];
  readonly events: readonly OrderEventRow[];
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
      paymentStatus: true,
      source: true,
      subtotal: true,
      discount: true,
      deliveryCharge: true,
      total: true,
      placedAt: true,
      updatedAt: true,
      customerId: true,
      conversationId: true,
      customer: { select: { name: true, email: true, phone: true } },
      deliveryZone: { select: { name: true } },
      shippingAddress: {
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          addressLine: true,
          city: true,
          region: true,
          isDefault: true,
          deliveryZone: { select: { name: true } },
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
        orderBy: { paidAt: "desc" },
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
      events: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          actorType: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) return null;

  const address = order.shippingAddress;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    source: order.source,
    subtotal: order.subtotal.toString(),
    discount: order.discount.toString(),
    deliveryCharge: order.deliveryCharge.toString(),
    total: order.total.toString(),
    placedAt: order.placedAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customerId: order.customerId,
    customerName: order.customer?.name ?? null,
    customerEmail: order.customer?.email ?? null,
    customerPhone: order.customer?.phone ?? null,
    conversationId: order.conversationId,
    deliveryZoneName: order.deliveryZone?.name ?? null,
    shippingAddress:
      address === null
        ? null
        : {
            id: address.id,
            label: address.label,
            recipientName: address.recipientName,
            phone: address.phone,
            addressLine: address.addressLine,
            city: address.city,
            region: address.region,
            isDefault: address.isDefault,
            deliveryZoneName: address.deliveryZone?.name ?? null,
          },
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
    events: order.events.map((event) => ({
      // BigInt does not survive the boundary into a Client Component.
      id: event.id.toString(),
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
