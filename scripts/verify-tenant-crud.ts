import "dotenv/config";

import { Client } from "pg";

import { env } from "@/config/env";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/features/tenant-dashboard/categories/service";
import {
  createAddress,
  createCustomer,
  deleteCustomer,
  findCustomer,
  listCustomerOptions,
  listCustomers,
  setCustomerStatus,
  updateCustomer,
} from "@/features/tenant-dashboard/customers/service";
import {
  createOrder,
  deleteOrder,
  findOrder,
  listOrders,
  setOrderStatus,
  updateOrder,
} from "@/features/tenant-dashboard/orders/service";
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  findProduct,
  listProducts,
  listVariantOptions,
  updateProduct,
  updateVariant,
} from "@/features/tenant-dashboard/products/service";
import { prisma } from "@/server/db/prisma";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import { releaseTenantPrisma } from "@/server/tenancy/tenant-prisma";

/**
 * The tenant dashboard's CRUD, against a real provisioned tenant database.
 *
 * The services are the whole of the write path — the Server Actions add the
 * guard and nothing else — so exercising them here covers what the screens do.
 * Run against a real database rather than a mock, because most of what is
 * asserted below is behaviour Postgres enforces: unique slugs, restricted
 * deletes, and decimal money that must survive the round trip unrounded.
 */

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

interface Fixture {
  readonly tenantId: string;
  readonly slug: string;
  readonly databaseName: string;
}

async function main(): Promise<void> {
  const fixture = await createTenant(`verify-crud-${Date.now().toString(36)}`);

  try {
    const resolved = await resolveTenant(fixture.slug);
    check(resolved.ok, "The verification tenant did not resolve.");
    if (!resolved.ok) return;

    const db = resolved.tenant.db;

    // ---- categories -------------------------------------------------------
    const category = await createCategory(db, {
      name: "Drinks",
      slug: "drinks",
      isActive: true,
    });
    check(category.ok, "Category was not created.");
    if (!category.ok) return;

    const duplicate = await createCategory(db, {
      name: "Drinks Again",
      slug: "drinks",
      isActive: true,
    });
    check(
      !duplicate.ok && duplicate.reason === "duplicate-slug",
      "A duplicate category slug was accepted.",
    );

    const renamed = await updateCategory(db, category.id, {
      name: "Cold Drinks",
      slug: "cold-drinks",
      isActive: true,
    });
    check(renamed.ok, "Category was not updated.");

    const cycle = await updateCategory(db, category.id, {
      name: "Cold Drinks",
      slug: "cold-drinks",
      parentId: category.id,
      isActive: true,
    });
    check(
      !cycle.ok && cycle.reason === "cycle",
      "A category was allowed to parent itself.",
    );

    const categoryPage = await listCategories(db, { limit: 20, offset: 0 });
    check(categoryPage.total === 1, "The category list did not show one row.");

    // ---- products and variants -------------------------------------------
    const product = await createProduct(db, {
      name: "Iced Coffee",
      slug: "iced-coffee",
      categoryId: category.id,
      status: "ACTIVE",
      basePrice: "3.75",
      compareAtPrice: null,
      openingSku: "ICED-SMALL",
      openingStock: 4,
    });
    check(product.ok, "Product was not created.");
    if (!product.ok) return;

    // A product is born sellable. Without its first variant it has no price a
    // customer can pay, no SKU and no stock, and no order line can name it.
    const asCreated = await findProduct(db, product.id);
    check(
      asCreated?.variants.length === 1,
      "Creating a product did not create its first variant.",
    );
    check(
      asCreated?.variants[0]?.sku === "ICED-SMALL" &&
        asCreated?.variants[0]?.price === "3.75" &&
        asCreated?.variants[0]?.quantity === 4,
      "The opening variant did not take the price and stock it was given.",
    );
    check(
      (await listVariantOptions(db)).length === 1,
      "The opening variant was not offered as sellable.",
    );

    // A product created without a SKU still gets one, derived from the slug.
    const unnamed = await createProduct(db, {
      name: "Cold Brew",
      slug: "cold-brew",
      status: "ACTIVE",
      basePrice: "5.00",
      compareAtPrice: null,
      openingSku: null,
      openingStock: 0,
    });
    check(unnamed.ok, "Product without an explicit SKU was not created.");
    if (!unnamed.ok) return;
    const derived = await findProduct(db, unnamed.id);
    check(
      derived?.variants[0]?.sku === "COLD-BREW",
      `The derived SKU was ${derived?.variants[0]?.sku}, not COLD-BREW.`,
    );
    check(
      (await deleteProduct(db, unnamed.id)).ok,
      "Cold Brew was not removed.",
    );

    const variant = await createVariant(db, product.id, {
      sku: "ICED-LARGE",
      price: "4.25",
      compareAtPrice: null,
      isActive: true,
      quantity: 10,
      reorderLevel: 2,
    });
    check(variant.ok, "Variant was not created.");
    if (!variant.ok) return;

    const duplicateSku = await createVariant(db, product.id, {
      sku: "ICED-LARGE",
      price: "4.25",
      compareAtPrice: null,
      isActive: true,
      quantity: 1,
      reorderLevel: null,
    });
    check(
      !duplicateSku.ok && duplicateSku.reason === "duplicate-sku",
      "A duplicate SKU was accepted.",
    );

    const detail = await findProduct(db, product.id);
    check(detail !== null, "The product could not be read back.");
    check(
      detail?.variants.find((row) => row.sku === "ICED-LARGE")?.quantity === 10,
      "Inventory was not written with the variant.",
    );
    check(
      detail?.basePrice === "3.75",
      `Base price came back as ${detail?.basePrice}, not 3.75.`,
    );

    const restocked = await updateVariant(db, product.id, variant.id, {
      sku: "ICED-LARGE",
      price: "4.50",
      compareAtPrice: "5.00",
      isActive: true,
      quantity: 25,
      reorderLevel: 5,
    });
    check(restocked.ok, "Variant was not updated.");

    // A variant id from another product is not this product's row to touch.
    const otherProduct = await createProduct(db, {
      name: "Hot Coffee",
      slug: "hot-coffee",
      status: "DRAFT",
      basePrice: "3.00",
      compareAtPrice: null,
      openingSku: "HOT-1",
      openingStock: 3,
    });
    check(otherProduct.ok, "Second product was not created.");
    if (!otherProduct.ok) return;

    const crossProduct = await updateVariant(db, otherProduct.id, variant.id, {
      sku: "STOLEN",
      price: "0.01",
      compareAtPrice: null,
      isActive: true,
      quantity: 0,
      reorderLevel: null,
    });
    check(
      !crossProduct.ok && crossProduct.reason === "not-found",
      "A variant was edited through the wrong product.",
    );

    // The update path has to refuse a slug another product already holds.
    const slugClash = await updateProduct(db, otherProduct.id, {
      name: "Hot Coffee",
      slug: "iced-coffee",
      status: "DRAFT",
      basePrice: "3.00",
      compareAtPrice: null,
      openingSku: null,
      openingStock: 0,
    });
    check(
      !slugClash.ok && slugClash.reason === "duplicate-slug",
      "A product took a slug another product already holds.",
    );

    const productPage = await listProducts(db, {
      limit: 20,
      offset: 0,
      status: "ACTIVE",
    });
    check(
      productPage.total === 1 && productPage.items[0]?.name === "Iced Coffee",
      "The product status filter did not narrow the list.",
    );

    const sellable = await listVariantOptions(db);
    check(
      sellable.some(
        (option) => option.sku === "ICED-LARGE" && option.available === 25,
      ),
      "Sellable variants did not report the stock on hand.",
    );
    check(
      // A draft product's variant *is* offered here, and deliberately so: this
      // is the owner's own order form, and taking an order over the phone for
      // something not yet published is their business. The storefront applies
      // the stricter rule — see verify:assistant.
      sellable.some((option) => option.sku === "HOT-1"),
      "The owner's order form hid a draft product's variant.",
    );

    // A category with products cannot be deleted out from under them.
    const categoryInUse = await deleteCategory(db, category.id);
    check(
      !categoryInUse.ok && categoryInUse.reason === "has-products",
      "A category with products was deleted.",
    );

    // ---- customers and addresses -----------------------------------------
    const customer = await createCustomer(db, {
      name: "Ada Lovelace",
      email: "ada@example.invalid",
      phone: "+1 555 010 0001",
      status: "ACTIVE",
    });
    check(customer.ok, "Customer was not created.");
    if (!customer.ok) return;

    const firstAddress = await createAddress(db, customer.id, {
      label: "Home",
      recipientName: "Ada Lovelace",
      phone: "+1 555 010 0001",
      addressLine: "12 Analytical Way",
      city: "London",
      region: null,
      postalCode: null,
      isDefault: false,
    });
    check(firstAddress.ok, "Address was not created.");
    if (!firstAddress.ok) return;

    const secondAddress = await createAddress(db, customer.id, {
      label: "Office",
      recipientName: "Ada Lovelace",
      phone: "+1 555 010 0002",
      addressLine: "1 Engine Street",
      city: "London",
      region: null,
      postalCode: null,
      isDefault: true,
    });
    check(secondAddress.ok, "Second address was not created.");
    if (!secondAddress.ok) return;

    const withAddresses = await findCustomer(db, customer.id);
    const defaults =
      withAddresses?.addresses.filter((address) => address.isDefault) ?? [];
    check(
      defaults.length === 1 && defaults[0]?.id === secondAddress.id,
      "A customer ended up with something other than one default address.",
    );

    const searched = await listCustomers(db, {
      limit: 20,
      offset: 0,
      search: "ada@",
    });
    check(searched.total === 1, "Customer search by email found nothing.");

    const blocked = await setCustomerStatus(db, customer.id, "BLOCKED");
    check(blocked.ok, "Customer was not blocked.");
    check(
      (await listCustomerOptions(db)).length === 0,
      "A blocked customer was still offered to the order form.",
    );
    check(
      (await listCustomerOptions(db, [customer.id])).length === 1,
      "A blocked customer was not offered back to the order that names them.",
    );
    await setCustomerStatus(db, customer.id, "ACTIVE");

    await updateCustomer(db, customer.id, {
      name: "Ada Byron",
      email: "ada@example.invalid",
      phone: null,
      status: "ACTIVE",
    });
    check(
      (await findCustomer(db, customer.id))?.name === "Ada Byron",
      "Customer was not renamed.",
    );

    // ---- orders -----------------------------------------------------------
    const order = await createOrder(db, {
      customerId: customer.id,
      shippingAddressId: secondAddress.id,
      status: "PENDING",
      discount: "1.00",
      shippingFee: "2.50",
      tax: "0.45",
      // The same variant twice is one line of four, not two lines of two.
      items: [
        { productVariantId: variant.id, quantity: 2 },
        { productVariantId: variant.id, quantity: 2 },
      ],
    });
    check(order.ok, "Order was not created.");
    if (!order.ok) return;

    const placed = await findOrder(db, order.id);
    check(placed !== null, "The order could not be read back.");
    check(placed?.items.length === 1, "Repeated lines were not merged.");
    check(
      placed?.items[0]?.quantity === 4,
      "Merged line did not carry the summed quantity.",
    );
    // 4 × 4.50 = 18.00, less 1.00, plus 2.50 and 0.45.
    check(
      placed?.subtotal === "18.00",
      `Subtotal came back as ${placed?.subtotal}, not 18.00.`,
    );
    check(
      placed?.total === "19.95",
      `Total came back as ${placed?.total}, not 19.95.`,
    );
    check(
      placed?.items[0]?.productName === "Iced Coffee" &&
        placed?.items[0]?.sku === "ICED-LARGE",
      "The line did not snapshot the product name and SKU.",
    );
    check(
      /^ORD-\d{8}-[0-9A-Z]{4}$/.test(placed?.orderNumber ?? ""),
      `Order number ${placed?.orderNumber} is not in the expected shape.`,
    );

    // An address belonging to nobody in this order cannot be shipped to.
    const stranger = await createCustomer(db, {
      name: "Someone Else",
      email: null,
      phone: null,
      status: "ACTIVE",
    });
    check(stranger.ok, "Second customer was not created.");
    if (!stranger.ok) return;

    const mismatched = await createOrder(db, {
      customerId: stranger.id,
      shippingAddressId: secondAddress.id,
      status: "PENDING",
      discount: "0",
      shippingFee: "0",
      tax: "0",
      items: [{ productVariantId: variant.id, quantity: 1 }],
    });
    check(
      !mismatched.ok && mismatched.reason === "address-mismatch",
      "An order was shipped to another customer's address.",
    );

    const overDiscounted = await createOrder(db, {
      customerId: customer.id,
      shippingAddressId: null,
      status: "PENDING",
      discount: "999.00",
      shippingFee: "0",
      tax: "0",
      items: [{ productVariantId: variant.id, quantity: 1 }],
    });
    check(
      !overDiscounted.ok && overDiscounted.reason === "discount-too-large",
      "A discount larger than the goods was accepted.",
    );

    const edited = await updateOrder(db, order.id, {
      customerId: customer.id,
      shippingAddressId: firstAddress.id,
      status: "CONFIRMED",
      discount: "0",
      shippingFee: "0",
      tax: "0",
      items: [{ productVariantId: variant.id, quantity: 1 }],
    });
    check(edited.ok, "Order was not updated.");

    const reopened = await findOrder(db, order.id);
    check(
      reopened?.items.length === 1 && reopened.items[0]?.quantity === 1,
      "The edited order kept its old lines.",
    );
    check(
      reopened?.total === "4.50",
      `Edited total came back as ${reopened?.total}, not 4.50.`,
    );
    check(
      reopened?.shippingAddressId === firstAddress.id,
      "The edited order kept its old delivery address.",
    );

    const shipped = await setOrderStatus(db, order.id, "SHIPPED");
    check(shipped.ok, "Order status was not changed.");
    check(
      (await listOrders(db, { limit: 20, offset: 0, status: "SHIPPED" }))
        .total === 1,
      "The order status filter did not find the shipped order.",
    );

    // ---- what may not be deleted -----------------------------------------
    const soldVariant = await deleteVariant(db, product.id, variant.id);
    check(
      !soldVariant.ok && soldVariant.reason === "has-orders",
      "A variant that appears on an order was deleted.",
    );

    const soldProduct = await deleteProduct(db, product.id);
    check(
      !soldProduct.ok && soldProduct.reason === "has-orders",
      "A product that has been ordered was deleted.",
    );

    const orderingCustomer = await deleteCustomer(db, customer.id);
    check(
      !orderingCustomer.ok && orderingCustomer.reason === "has-orders",
      "A customer with orders was deleted.",
    );

    // Money that has moved keeps the order alive.
    await db.orderPayment.create({
      data: {
        orderId: order.id,
        provider: "verify",
        amount: "4.50",
        currency: "USD",
        status: "PAID",
      },
    });
    const paidOrder = await deleteOrder(db, order.id);
    check(
      !paidOrder.ok && paidOrder.reason === "has-payments",
      "An order with a settled payment was deleted.",
    );

    // ---- and what may ----------------------------------------------------
    await db.orderPayment.deleteMany({ where: { orderId: order.id } });
    check((await deleteOrder(db, order.id)).ok, "Order was not deleted.");
    check(
      (await deleteVariant(db, product.id, variant.id)).ok,
      "Variant was not deleted once its order was gone.",
    );
    check((await deleteProduct(db, product.id)).ok, "Product was not deleted.");
    check(
      (await deleteProduct(db, otherProduct.id)).ok,
      "Second product was not deleted.",
    );
    check(
      (await deleteCustomer(db, customer.id)).ok,
      "Customer was not deleted once their order was gone.",
    );
    check(
      (await deleteCustomer(db, stranger.id)).ok,
      "Second customer was not deleted.",
    );
    check(
      (await deleteCategory(db, category.id)).ok,
      "Category was not deleted once its products were gone.",
    );

    check((await db.order.count()) === 0, "Orders were left behind.");
    check((await db.orderItem.count()) === 0, "Order lines were left behind.");
    check((await db.address.count()) === 0, "Addresses were left behind.");
    check((await db.inventory.count()) === 0, "Inventory was left behind.");

    console.log(
      `Tenant CRUD verified in ${fixture.databaseName}: categories, products, ` +
        `variants with inventory, customers with addresses and orders created, ` +
        `read, filtered, updated and deleted; duplicate slugs and SKUs, category ` +
        `cycles, cross-product variant edits, mismatched addresses and excessive ` +
        `discounts all refused; sold products, ordering customers and settled ` +
        `orders held on to. Cleaned up.`,
    );
  } finally {
    await destroy(fixture);
  }
}

async function createTenant(slug: string): Promise<Fixture> {
  const databaseName = `sp_tenant_${slug.replace(/-/g, "_")}`;

  const tenant = await prisma.tenant.create({
    data: {
      tenantCode: `TEN-VERIFY-${slug.slice(-12)}`,
      businessName: `Verify ${slug}`,
      ownerName: "Verify Owner",
      ownerEmail: `${slug}@example.invalid`,
      ownerPhone: "+1 555 000 0000",
      industry: "Testing",
      region: "US-East-1",
      subdomain: slug,
      approvalStatus: "ACTIVE",
      database: {
        create: {
          databaseName,
          hostReference: "pending",
          port: 5432,
          usernameReference: "pending",
          secretReference: "pending",
          status: "PENDING",
          schemaVersion: "0",
          region: "US-East-1",
        },
      },
    },
    select: { id: true },
  });

  const provisioned = await provisionDatabaseForTenant(tenant.id);

  if (!provisioned.ok) {
    throw new Error(`Could not provision ${slug}: ${provisioned.reason}`);
  }

  return { tenantId: tenant.id, slug, databaseName };
}

async function destroy(fixture: Fixture): Promise<void> {
  // Close the cached pool first. Terminating its backends from underneath it
  // makes pg emit an unhandled 'error' on the pool, which takes the process
  // down before the drop completes.
  await releaseTenantPrisma(fixture.tenantId);

  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });

  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [fixture.databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${fixture.databaseName}"`);
  } finally {
    await admin.end().catch(() => undefined);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
