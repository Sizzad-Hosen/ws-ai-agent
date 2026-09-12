import "dotenv/config";

import {
  getCategory,
  getCustomer,
  getOrder,
  getProduct,
  listCategoryOptions,
} from "@/features/tenant-workspace/detail-service";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/**
 * Proves the catalogue detail reads against a live tenant database.
 *
 * The schemas and the slug rules are covered by unit tests, which touch no
 * connection. This covers what they cannot: that every Prisma select here is
 * valid against the real tenant schema. A `_count` on a relation that does not
 * exist, or a nested select through a nullable relation, both type-check
 * against the generated client and fail only when a query runs.
 *
 * Run it with `npm run verify:catalogue` after `npm run db:seed`.
 */

const SLUG = "northwind";

function assert(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

async function main(): Promise<void> {
  const resolution = await resolveTenant(SLUG);

  if (!resolution.ok) {
    throw new Error(
      `Tenant "${SLUG}" did not resolve (${resolution.reason}). Run npm run db:seed first.`,
    );
  }

  const db = resolution.tenant.db;

  // ---- categories --------------------------------------------------------
  const options = await listCategoryOptions(db);
  assert(options.length > 0, "No categories found. Run npm run db:seed.");

  const category = await getCategory(db, options[0]!.id);
  assert(category !== null, "A category that exists was not found.");
  assert(
    typeof category?.productCount === "number",
    "category.productCount is counted",
  );

  // ---- products ----------------------------------------------------------
  const firstProduct = await db.product.findFirst({ select: { id: true } });
  assert(firstProduct !== null, "No products found. Run npm run db:seed.");

  const product = await getProduct(db, firstProduct!.id);
  assert(product !== null, "A product that exists was not found.");
  assert(product!.variants.length > 0, "The product has at least one variant");
  assert(
    typeof product!.orderedCount === "number",
    "orderedCount sums across variants",
  );
  assert(
    product!.variants.every((variant) => typeof variant.price === "string"),
    "variant prices are strings, not Decimal objects",
  );

  // A product with no inventory row must report null stock, not zero: "not
  // tracked" and "none left" are different things on the screen.
  const untracked = await db.product.findFirst({
    where: { variants: { every: { inventory: null } } },
    select: { id: true },
  });

  if (untracked) {
    const detail = await getProduct(db, untracked.id);
    assert(
      detail?.variants.every((variant) => variant.quantity === null) === true,
      "an untracked variant reports null stock rather than zero",
    );
  }

  // ---- customers ---------------------------------------------------------
  const firstCustomer = await db.customer.findFirst({ select: { id: true } });
  assert(firstCustomer !== null, "No customers found. Run npm run db:seed.");

  const customer = await getCustomer(db, firstCustomer!.id);
  assert(customer !== null, "A customer that exists was not found.");
  assert(
    /^\d+\.\d{2}$/.test(customer!.lifetimeValue),
    `lifetimeValue keeps two decimals, got "${customer?.lifetimeValue}"`,
  );
  assert(
    customer!.orderCount === customer!.orders.length,
    "orderCount matches the orders listed",
  );

  // ---- orders ------------------------------------------------------------
  const firstOrder = await db.order.findFirst({ select: { id: true } });
  assert(firstOrder !== null, "No orders found. Run npm run db:seed.");

  const order = await getOrder(db, firstOrder!.id);
  assert(order !== null, "An order that exists was not found.");
  assert(order!.items.length > 0, "the order has line items");
  assert(
    order!.items.every((item) => item.productName.length > 0),
    "line items read the name snapshot, so they survive a rename",
  );

  // ---- a missing row is null, not a throw --------------------------------
  const absent = "00000000-0000-0000-0000-000000000000";
  assert((await getProduct(db, absent)) === null, "a missing product is null");
  assert((await getOrder(db, absent)) === null, "a missing order is null");
  assert(
    (await getCustomer(db, absent)) === null,
    "a missing customer is null",
  );
  assert(
    (await getCategory(db, absent)) === null,
    "a missing category is null",
  );

  console.info(
    `verify:catalogue passed — ${options.length} categories, ` +
      `product "${product!.name}" with ${product!.variants.length} variant(s), ` +
      `customer "${customer!.name}" worth ${customer!.lifetimeValue}, ` +
      `order ${order!.orderNumber} with ${order!.items.length} line(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Tenant pools are cached in module scope; without this the process hangs.
    process.exit(process.exitCode ?? 0);
  });
