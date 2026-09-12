/**
 * A small catalogue and order book inside the seeded tenant's database.
 *
 * The Customers, Products, Categories and Orders screens are each a table, and
 * a table with no rows cannot be reviewed — the same reason `seedTenant` puts
 * one tenant in the master database. Six products is enough to show grouping,
 * pricing, stock and an out-of-stock line; five orders is enough to show every
 * status the list renders differently.
 *
 * Idempotent. Categories and products converge on their unique `slug`,
 * variants on `sku` and orders on `order_number`, so a second run changes
 * nothing. Customers have no unique column in the tenant schema, so they are
 * looked up by email first — the same approach `seedAi` takes for providers.
 */
import { daysAgo } from "./helpers";

import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

const CATEGORIES = [
  { slug: "fresh-produce", name: "Fresh Produce" },
  { slug: "pantry", name: "Pantry" },
  { slug: "household", name: "Household" },
] as const;

const PRODUCTS = [
  {
    slug: "basmati-rice-5kg",
    name: "Basmati Rice 5kg",
    category: "pantry",
    status: "ACTIVE",
    basePrice: "890.00",
    sku: "RICE-BAS-5K",
    stock: 120,
  },
  {
    slug: "mustard-oil-1l",
    name: "Mustard Oil 1L",
    category: "pantry",
    status: "ACTIVE",
    basePrice: "320.00",
    sku: "OIL-MUS-1L",
    stock: 64,
  },
  {
    slug: "red-lentils-1kg",
    name: "Red Lentils 1kg",
    category: "pantry",
    status: "ACTIVE",
    basePrice: "145.00",
    sku: "LEN-RED-1K",
    stock: 0,
  },
  {
    slug: "tomatoes-1kg",
    name: "Tomatoes 1kg",
    category: "fresh-produce",
    status: "ACTIVE",
    basePrice: "75.00",
    sku: "VEG-TOM-1K",
    stock: 38,
  },
  {
    slug: "dish-soap-500ml",
    name: "Dish Soap 500ml",
    category: "household",
    status: "ACTIVE",
    basePrice: "110.00",
    sku: "HSE-DSH-500",
    stock: 91,
  },
  {
    slug: "winter-hamper",
    name: "Winter Hamper",
    category: null,
    status: "DRAFT",
    basePrice: "1450.00",
    sku: "GFT-WIN-001",
    stock: null,
  },
] as const;

const CUSTOMERS = [
  {
    email: "farhana.akter@example.com",
    name: "Farhana Akter",
    phone: "+8801711000101",
    status: "ACTIVE",
  },
  {
    email: "rakib.hasan@example.com",
    name: "Rakib Hasan",
    phone: "+8801711000102",
    status: "ACTIVE",
  },
  {
    email: "nusrat.jahan@example.com",
    name: "Nusrat Jahan",
    phone: "+8801711000103",
    status: "ACTIVE",
  },
  {
    email: "imran.kabir@example.com",
    name: "Imran Kabir",
    phone: "+8801711000104",
    status: "BLOCKED",
  },
] as const;

const ORDERS = [
  {
    number: "ORD-1001",
    customer: "farhana.akter@example.com",
    status: "DELIVERED",
    sku: "RICE-BAS-5K",
    quantity: 2,
    daysAgo: 12,
  },
  {
    number: "ORD-1002",
    customer: "rakib.hasan@example.com",
    status: "SHIPPED",
    sku: "OIL-MUS-1L",
    quantity: 3,
    daysAgo: 6,
  },
  {
    number: "ORD-1003",
    customer: "nusrat.jahan@example.com",
    status: "PROCESSING",
    sku: "VEG-TOM-1K",
    quantity: 4,
    daysAgo: 3,
  },
  {
    number: "ORD-1004",
    customer: "farhana.akter@example.com",
    status: "PENDING",
    sku: "HSE-DSH-500",
    quantity: 1,
    daysAgo: 1,
  },
  {
    number: "ORD-1005",
    customer: "imran.kabir@example.com",
    status: "CANCELLED",
    sku: "LEN-RED-1K",
    quantity: 5,
    daysAgo: 9,
  },
] as const;

/** Flat 60.00 delivery, so the order totals on screen are arithmetic anyone can check. */
const SHIPPING_FEE = 60;

export interface SeededCatalogue {
  readonly categories: number;
  readonly products: number;
  readonly customers: number;
  readonly orders: number;
}

export async function seedCatalogue(slug: string): Promise<SeededCatalogue> {
  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    console.warn(
      `Skipping catalogue seed: tenant "${slug}" did not resolve (${resolution.reason}).`,
    );
    return { categories: 0, products: 0, customers: 0, orders: 0 };
  }

  const db = resolution.tenant.db;

  const categoryIds = await seedCategories(db);
  const variantIds = await seedProducts(db, categoryIds);
  const customerIds = await seedCustomers(db);
  await seedOrders(db, customerIds, variantIds);

  return {
    categories: await db.category.count(),
    products: await db.product.count(),
    customers: await db.customer.count(),
    orders: await db.order.count(),
  };
}

async function seedCategories(
  db: TenantPrismaClient,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const category of CATEGORIES) {
    const row = await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, isActive: true },
      create: { slug: category.slug, name: category.name, isActive: true },
      select: { id: true },
    });

    ids.set(category.slug, row.id);
  }

  return ids;
}

/** Returns variant ids keyed by SKU, which the orders below reference. */
async function seedProducts(
  db: TenantPrismaClient,
  categoryIds: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const product of PRODUCTS) {
    const fields = {
      name: product.name,
      status: product.status,
      basePrice: product.basePrice,
      categoryId:
        product.category === null
          ? null
          : (categoryIds.get(product.category) ?? null),
    };

    const row = await db.product.upsert({
      where: { slug: product.slug },
      update: fields,
      create: { slug: product.slug, ...fields },
      select: { id: true },
    });

    const variant = await db.productVariant.upsert({
      where: { sku: product.sku },
      update: { price: product.basePrice, isActive: true },
      create: {
        productId: row.id,
        sku: product.sku,
        price: product.basePrice,
        isActive: true,
      },
      select: { id: true },
    });

    ids.set(product.sku, variant.id);

    // A null stock means this product tracks no inventory at all, which the
    // Products screen renders as "Not tracked" rather than as zero.
    if (product.stock !== null) {
      await db.inventory.upsert({
        where: { productVariantId: variant.id },
        update: { quantity: product.stock },
        create: { productVariantId: variant.id, quantity: product.stock },
      });
    }
  }

  return ids;
}

async function seedCustomers(
  db: TenantPrismaClient,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const customer of CUSTOMERS) {
    // `customers.email` is nullable and not unique in the tenant schema, so
    // this cannot upsert on it.
    const existing = await db.customer.findFirst({
      where: { email: customer.email },
      select: { id: true },
    });

    const fields = {
      name: customer.name,
      phone: customer.phone,
      status: customer.status,
    };

    const row = existing
      ? await db.customer.update({
          where: { id: existing.id },
          data: fields,
          select: { id: true },
        })
      : await db.customer.create({
          data: { email: customer.email, ...fields },
          select: { id: true },
        });

    ids.set(customer.email, row.id);
  }

  return ids;
}

async function seedOrders(
  db: TenantPrismaClient,
  customerIds: ReadonlyMap<string, string>,
  variantIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const order of ORDERS) {
    const existing = await db.order.findUnique({
      where: { orderNumber: order.number },
      select: { id: true },
    });

    if (existing) continue;

    const product = PRODUCTS.find((item) => item.sku === order.sku);
    const variantId = variantIds.get(order.sku);
    const customerId = customerIds.get(order.customer);

    if (!product || !variantId || !customerId) continue;

    const unitPrice = Number(product.basePrice);
    const subtotal = unitPrice * order.quantity;
    const total = subtotal + SHIPPING_FEE;
    const placedAt = daysAgo(order.daysAgo);

    await db.order.create({
      data: {
        orderNumber: order.number,
        customerId,
        status: order.status,
        subtotal: subtotal.toFixed(2),
        shippingFee: SHIPPING_FEE.toFixed(2),
        total: total.toFixed(2),
        placedAt,
        items: {
          create: {
            productVariantId: variantId,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            unitPrice: unitPrice.toFixed(2),
            quantity: order.quantity,
            total: subtotal.toFixed(2),
          },
        },
      },
    });
  }
}
