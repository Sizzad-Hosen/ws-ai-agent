import "dotenv/config";

// The deterministic assistant is what this script verifies, so the model is
// taken out of the picture before anything imports the client that reads this.
// With a key present the same conversation would still work, but the replies
// would be model-written and no assertion on their wording could be exact.
delete process.env.ANTHROPIC_API_KEY;

import { Client } from "pg";

import { env } from "@/config/env";
import {
  respondToCustomer,
  type ProductCard,
} from "@/features/storefront-assistant/agent";
import {
  listStorefrontVariants,
  storefrontReadiness,
} from "@/features/storefront-assistant/catalogue";
import {
  newDraft,
  type AssistantDraft,
} from "@/features/storefront-assistant/session";
import {
  loadAssistantSettings,
  saveAssistantSettings,
  saveFaq,
} from "@/features/storefront-assistant/settings";
import {
  addDefaultVariant,
  createProduct,
} from "@/features/tenant-dashboard/products/service";
import { prisma } from "@/server/db/prisma";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import {
  releaseTenantPrisma,
  type TenantPrismaClient,
} from "@/server/tenancy/tenant-prisma";

/**
 * The storefront assistant, against two real provisioned tenant databases.
 *
 * Two shops rather than one, because the property that matters most here is
 * not that the assistant answers — it is that it answers *only* out of the
 * shop whose page the customer is on. That cannot be demonstrated with one
 * tenant, and it cannot be demonstrated with mocks: a mocked catalogue is
 * isolated because the mock says so.
 *
 * The whole conversation is driven through `respondToCustomer`, the same
 * function the Server Action calls, with the draft passed in and out the way
 * the signed cookie carries it. The order it produces is then read back out of
 * the shop's own tables, because "the AI took an order" is only true if the
 * order is in the database the owner reads.
 */

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

interface Fixture {
  readonly tenantId: string;
  readonly slug: string;
  readonly databaseName: string;
  readonly db: TenantPrismaClient;
  readonly businessName: string;
}

/** One customer turn, carrying the draft forward like the cookie does. */
async function say(
  fixture: Fixture,
  draft: AssistantDraft,
  message: string,
  selectVariantId: string | null = null,
): Promise<{
  reply: string;
  draft: AssistantDraft;
  cards: readonly ProductCard[];
}> {
  const settings = await loadAssistantSettings(fixture.db);
  const outcome = await respondToCustomer({
    db: fixture.db,
    businessName: fixture.businessName,
    settings,
    draft,
    message,
    history: [],
    selectVariantId,
  });

  return { reply: outcome.reply, draft: outcome.draft, cards: outcome.cards };
}

/** The product names a turn offered as cards. */
function offered(cards: readonly ProductCard[]): readonly string[] {
  return cards.map((card) => card.productName);
}

const BANGLA_SCRIPT = /[ঀ-৿]/;

async function main(): Promise<void> {
  const stamp = Date.now().toString(36);
  const shopA = await createTenant(`verify-chat-a-${stamp}`, "Cafe Alpha");
  const shopB = await createTenant(`verify-chat-b-${stamp}`, "Bakery Beta");

  try {
    // ---- what each shop sells ---------------------------------------------
    await seedCatalogue(shopA.db, {
      product: "Iced Coffee",
      slug: "iced-coffee",
      sku: "ICED-LARGE",
      price: "4.50",
      quantity: 25,
    });
    await seedCatalogue(shopB.db, {
      product: "Hot Samosa",
      slug: "hot-samosa",
      sku: "SAMOSA-6",
      price: "1.25",
      quantity: 40,
    });

    await saveAssistantSettings(shopA.db, {
      ...(await loadAssistantSettings(shopA.db)),
      currency: "BDT",
      homeCity: "Dhaka",
      deliveryInsideCity: "80",
      deliveryOutsideCity: "150",
    });
    await saveFaq(shopA.db, [
      {
        question: "How long does delivery take?",
        answer: "Inside Dhaka we deliver the next day.",
        answerBangla: "ঢাকার ভেতরে পরদিনই ডেলিভারি হয়।",
      },
    ]);

    check(
      (await listStorefrontVariants(shopA.db)).length === 1,
      "Shop A should offer exactly one variant.",
    );

    // ---- a product added the ordinary way is on sale immediately ----------
    //
    // The regression this pins down: a product with no variant has no price a
    // customer can pay, no stock and nothing an order line can name, so it is
    // invisible on the storefront. A catalogue full of them looks stocked in
    // the dashboard and empty in the chat.
    const added = await createProduct(shopA.db, {
      name: "Almond Croissant",
      slug: "almond-croissant",
      status: "ACTIVE",
      basePrice: "2.25",
      compareAtPrice: null,
      openingSku: null,
      openingStock: 6,
    });
    check(added.ok, "The product was not created.");
    if (!added.ok) return;

    const offeredNow = await listStorefrontVariants(shopA.db);
    check(
      offeredNow.some((entry) => entry.productName === "Almond Croissant"),
      "A product added the ordinary way was not offered to customers.",
    );
    check(
      offeredNow.find((entry) => entry.productName === "Almond Croissant")
        ?.available === 6,
      "The opening stock did not reach the storefront.",
    );

    // A draft stays hidden, and the readiness count says why.
    const draft = await createProduct(shopA.db, {
      name: "Secret Recipe",
      slug: "secret-recipe",
      status: "DRAFT",
      basePrice: "9.00",
      compareAtPrice: null,
      openingSku: null,
      openingStock: 3,
    });
    check(draft.ok, "The draft product was not created.");
    if (!draft.ok) return;

    check(
      (await listStorefrontVariants(shopA.db)).every(
        (entry) => entry.productName !== "Secret Recipe",
      ),
      "A draft product was offered to customers.",
    );

    // A product written straight into the table, with no variant, is the shape
    // that produced the empty shop — and it can be repaired in place.
    const bare = await shopA.db.product.create({
      data: {
        name: "Plain Bagel",
        slug: "plain-bagel",
        status: "ACTIVE",
        basePrice: "1.50",
      },
      select: { id: true },
    });

    let readiness = await storefrontReadiness(shopA.db);
    check(
      readiness.productsWithoutVariant === 1,
      `Readiness counted ${readiness.productsWithoutVariant} products without a variant, not 1.`,
    );
    check(
      readiness.draftProducts === 1,
      `Readiness counted ${readiness.draftProducts} drafts, not 1.`,
    );
    check(
      (await listStorefrontVariants(shopA.db)).every(
        (entry) => entry.productName !== "Plain Bagel",
      ),
      "A product with no variant was offered to customers.",
    );

    check(
      (await addDefaultVariant(shopA.db, bare.id, 4)).ok,
      "The missing variant could not be added.",
    );
    check(
      (await listStorefrontVariants(shopA.db)).some(
        (entry) => entry.productName === "Plain Bagel",
      ),
      "Repairing a product did not put it on sale.",
    );

    readiness = await storefrontReadiness(shopA.db);
    check(
      readiness.productsWithoutVariant === 0,
      "Readiness still reports a product without a variant.",
    );

    // Back to one product, so the assertions below stay about that one.
    await shopA.db.product.deleteMany({
      where: {
        slug: { in: ["almond-croissant", "secret-recipe", "plain-bagel"] },
      },
    });

    // ---- neither shop can see the other -----------------------------------
    let a = newDraft();
    let turn = await say(shopA, a, "ki ki product ache?");
    check(
      offered(turn.cards).includes("Iced Coffee"),
      `Shop A did not offer its own product: ${offered(turn.cards).join(", ")}`,
    );
    check(
      !offered(turn.cards).includes("Hot Samosa"),
      `Shop A offered Shop B's product: ${offered(turn.cards).join(", ")}`,
    );

    turn = await say(shopA, turn.draft, "hot samosa ache?");
    check(
      !offered(turn.cards).includes("Hot Samosa"),
      `Shop A found Shop B's product by name: ${turn.reply}`,
    );

    const b = await say(shopB, newDraft(), "iced coffee er dam koto?");
    check(
      !offered(b.cards).includes("Iced Coffee"),
      `Shop B found Shop A's product by name: ${b.reply}`,
    );

    // ---- prices and stock come from the shop's own rows -------------------
    turn = await say(shopA, newDraft(), "iced coffee er dam koto?");
    const card = turn.cards[0];
    check(card !== undefined, `No product card was offered: ${turn.reply}`);
    check(
      card.price.includes("4.50") || card.price.includes("4,50"),
      `The card price was not the catalogue price: ${card.price}`,
    );
    check(
      card.available === 25 && card.stockLabel.includes("25"),
      `The card did not carry the stock on hand: ${card.stockLabel}`,
    );

    // ---- tapping the card orders that exact row ---------------------------
    const tapped = await say(
      shopA,
      newDraft(),
      `${card.actionLabel}: ${card.productName}`,
      card.variantId,
    );
    check(
      tapped.draft.state === "awaiting_quantity" &&
        tapped.draft.variantId === card.variantId,
      `Tapping a card did not start the checkout on that variant: ${tapped.reply}`,
    );

    // An id for a row that is not on sale here is refused, not followed.
    const foreign = await say(shopB, newDraft(), "order this", card.variantId);
    check(
      foreign.draft.variantId === null,
      "One shop's card started a checkout on another shop's storefront.",
    );

    // ---- the reply follows the customer's language ------------------------
    const bangla = await say(shopA, newDraft(), "আপনাদের কি কি পণ্য আছে?");
    check(
      BANGLA_SCRIPT.test(bangla.reply),
      `A Bangla question was answered without Bangla: ${bangla.reply}`,
    );
    check(
      bangla.cards.every((entry) => BANGLA_SCRIPT.test(entry.stockLabel)),
      "The card labels were not in the language of the question.",
    );

    // ---- the shop's own written answer, not an invented one ---------------
    const faq = await say(shopA, newDraft(), "delivery koto din lage?");
    check(
      faq.reply.includes("next day"),
      `The shop's FAQ answer was not used: ${faq.reply}`,
    );
    const faqBangla = await say(shopA, newDraft(), "ডেলিভারি কত দিন লাগে?");
    check(
      faqBangla.reply.includes("পরদিনই"),
      `The Bangla FAQ answer was not used: ${faqBangla.reply}`,
    );

    // ---- an order, start to finish ----------------------------------------
    a = newDraft();
    turn = await say(shopA, a, "iced coffee kinbo");
    check(
      turn.draft.state === "awaiting_quantity",
      `Expected the quantity question, got state ${turn.draft.state}: ${turn.reply}`,
    );

    turn = await say(shopA, turn.draft, "100");
    check(
      turn.draft.state === "awaiting_quantity" && turn.reply.includes("25"),
      `More than the stock on hand was accepted: ${turn.reply}`,
    );

    turn = await say(shopA, turn.draft, "2 ta");
    check(
      turn.draft.state === "awaiting_name" && turn.draft.quantity === 2,
      `Expected the name question, got state ${turn.draft.state}.`,
    );

    turn = await say(shopA, turn.draft, "Ada Lovelace");
    check(
      turn.draft.state === "awaiting_phone",
      `Expected the phone question, got state ${turn.draft.state}.`,
    );

    turn = await say(shopA, turn.draft, "not a number");
    check(
      turn.draft.state === "awaiting_phone",
      "An invalid phone number was accepted.",
    );

    turn = await say(shopA, turn.draft, "01712345678");
    check(
      turn.draft.state === "awaiting_address" &&
        turn.draft.customerPhone === "+8801712345678",
      `The phone number was not normalised: ${turn.draft.customerPhone}`,
    );

    turn = await say(shopA, turn.draft, "12 Analytical Way, Banani, Dhaka");
    check(
      turn.draft.state === "awaiting_confirmation",
      `Expected the summary, got state ${turn.draft.state}: ${turn.reply}`,
    );
    // 2 × 4.50 = 9.00, plus the 80 inside-Dhaka delivery charge.
    check(
      turn.reply.includes("89"),
      `The summary total was not 89: ${turn.reply}`,
    );

    const notYet = await say(shopA, turn.draft, "ok sounds good");
    check(
      notYet.draft.state === "awaiting_confirmation" &&
        notYet.draft.orderNumber === null,
      "An order was placed without an explicit confirmation.",
    );
    check(
      (await shopA.db.order.count()) === 0,
      "An order row was written before it was confirmed.",
    );

    const confirmed = await say(shopA, notYet.draft, "CONFIRM ORDER");
    check(
      confirmed.draft.state === "order_placed" &&
        confirmed.draft.orderNumber !== null,
      `The confirmation did not place an order: ${confirmed.reply}`,
    );

    // ---- and it is an ordinary order in the shop's own tables -------------
    const order = await shopA.db.order.findFirstOrThrow({
      include: {
        items: true,
        customer: true,
        shippingAddress: true,
      },
    });

    check(
      order.orderNumber === confirmed.draft.orderNumber,
      "Order number mismatch.",
    );
    check(order.status === "PENDING", `Order status was ${order.status}.`);
    check(order.items.length === 1, "The order did not get exactly one line.");
    check(
      order.items[0]?.productNameSnapshot === "Iced Coffee" &&
        order.items[0]?.skuSnapshot === "ICED-LARGE",
      "The line did not snapshot the product it was for.",
    );
    check(order.items[0]?.quantity === 2, "The line quantity was not 2.");
    check(
      order.subtotal.toString() === "9",
      `Subtotal was ${order.subtotal.toString()}, not 9.`,
    );
    check(
      order.shippingFee.toString() === "80",
      `Delivery was ${order.shippingFee.toString()}, not the 80 inside-city rate.`,
    );
    check(
      order.total.toString() === "89",
      `Total was ${order.total.toString()}, not 89.`,
    );
    check(
      order.customer?.phone === "+8801712345678",
      "The order was not attached to the customer who placed it.",
    );
    check(
      order.customer?.name === "Ada Lovelace",
      "The customer name from the chat was not recorded.",
    );
    check(
      order.shippingAddress?.addressLine === "12 Analytical Way, Banani, Dhaka",
      "The delivery address from the chat was not recorded.",
    );
    check(
      order.shippingAddress?.city === "Dhaka",
      `The city was recorded as ${order.shippingAddress?.city}.`,
    );

    // ---- confirming twice does not order twice ----------------------------
    const again = await say(shopA, confirmed.draft, "CONFIRM ORDER");
    check(
      (await shopA.db.order.count()) === 1,
      `A repeated confirmation placed a second order: ${again.reply}`,
    );

    // ---- the write landed in one shop only --------------------------------
    check(
      (await shopB.db.order.count()) === 0,
      "Shop B received Shop A's order.",
    );
    check(
      (await shopB.db.customer.count()) === 0,
      "Shop B received Shop A's customer.",
    );

    // ---- a shopper can always walk away -----------------------------------
    const cancelled = await say(
      shopA,
      (await say(shopA, newDraft(), "iced coffee kinbo")).draft,
      "cancel",
    );
    check(
      cancelled.draft.state === "idle" && cancelled.draft.variantId === null,
      "Cancelling did not clear the draft order.",
    );

    // ---- a shop that turns the assistant off is off -----------------------
    await saveAssistantSettings(shopA.db, {
      ...(await loadAssistantSettings(shopA.db)),
      enabled: false,
    });
    const off = await say(shopA, newDraft(), "ki ki product ache?");
    check(
      !off.reply.includes("Iced Coffee"),
      "A disabled assistant still answered from the catalogue.",
    );

    console.log(
      `Storefront assistant verified across ${shopA.slug} and ${shopB.slug}: each shop ` +
        `answered only from its own catalogue, in the customer's language, with prices ` +
        `and stock read from its own rows; product cards carried those figures and ` +
        `ordered the exact row when tapped, and one shop's card was refused on the ` +
        `other's storefront; a full chat checkout wrote order ` +
        `${order.orderNumber} (${order.total.toString()} BDT) with its customer and ` +
        `address into that shop's tables and nowhere else; unconfirmed and ` +
        `double-confirmed turns placed no extra order. Cleaned up.`,
    );
  } finally {
    await destroy(shopA);
    await destroy(shopB);
  }
}

interface CatalogueSeed {
  readonly product: string;
  readonly slug: string;
  readonly sku: string;
  readonly price: string;
  readonly quantity: number;
}

async function seedCatalogue(
  db: TenantPrismaClient,
  seed: CatalogueSeed,
): Promise<void> {
  await db.product.create({
    data: {
      name: seed.product,
      slug: seed.slug,
      status: "ACTIVE",
      basePrice: seed.price,
      variants: {
        create: {
          sku: seed.sku,
          price: seed.price,
          isActive: true,
          inventory: { create: { quantity: seed.quantity } },
        },
      },
    },
  });
}

async function createTenant(
  slug: string,
  businessName: string,
): Promise<Fixture> {
  const databaseName = `sp_tenant_${slug.replace(/-/g, "_")}`;

  const tenant = await prisma.tenant.create({
    data: {
      tenantCode: `TEN-VERIFY-${slug.slice(-12)}`,
      businessName,
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

  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    throw new Error(`Could not resolve ${slug}: ${resolution.reason}`);
  }

  return {
    tenantId: tenant.id,
    slug,
    databaseName,
    db: resolution.tenant.db,
    businessName,
  };
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
