/**
 * Development seed for the master database.
 *
 * Every write is an upsert keyed on a natural unique column, so the seed
 * converges rather than duplicating. Run it twice and the second run changes
 * nothing. `npm run db:reset` drops the database, replays the migrations and
 * runs this file.
 *
 * It seeds configuration — the administrator, the plan catalogue, AI providers,
 * feature flags and platform settings — plus the fixtures the screens cannot be
 * reviewed without: one approved tenant, its physical database, AI usage
 * history inside that database, and one submitted registration.
 *
 * The tenant database step is not optional decoration. Without it the
 * `tenant_databases` row points at a database that was never created, so
 * `resolveTenant` fails and the tenant workspace cannot be opened.
 *
 * The seeded registration stays unapproved on purpose. Approving it is the
 * manual walkthrough, and it is the only path that creates a second tenant.
 */
import { prisma } from "./seed/client";
import { seedAdmin } from "./seed/admin";
import { seedAi } from "./seed/ai";
import { seedAiUsage } from "./seed/ai-usage";
import { seedCatalogue } from "./seed/catalogue";
import { seedPlans } from "./seed/plans";
import { seedPlatform } from "./seed/platform";
import { seedRegistration } from "./seed/registrations";
import { seedTenant } from "./seed/tenants";
import { seedTenantDatabase } from "./seed/tenant-database";

async function main(): Promise<void> {
  const admin = await seedAdmin();
  const plans = await seedPlans();
  const aiCatalogue = await seedAi();
  const platform = await seedPlatform();

  const business = plans["business"];
  const starter = plans["starter"];
  if (business === undefined || starter === undefined) {
    throw new Error("The plan catalogue did not seed the expected codes.");
  }

  const tenant = await seedTenant(business, admin.id);
  await seedRegistration(starter);

  // The tenant's own database, and the AI usage history inside it. Until this
  // runs, `tenant_databases` points at a database that does not exist and the
  // workspace cannot be opened at all.
  const database = await seedTenantDatabase(tenant.id);
  const usage = database.ready
    ? await seedAiUsage("northwind", aiCatalogue)
    : { logs: 0, conversations: 0 };
  const catalogue = database.ready
    ? await seedCatalogue("northwind")
    : { categories: 0, products: 0, customers: 0, orders: 0 };

  // Counted rather than quoted, so the summary cannot drift from the seed.
  console.info(
    `Seed complete: 1 administrator, ${Object.keys(plans).length} plans, ` +
      `3 AI providers, ${platform.flags} feature flags, ` +
      `${platform.settings} platform settings, 1 approved tenant with a ` +
      "database, owner and active subscription, and 1 submitted registration " +
      "with 3 pending checks.",
  );

  if (database.ready) {
    console.info(
      `Tenant database ${database.databaseName} is ready with ` +
        `${usage.conversations} conversations, ${usage.logs} AI usage rows, ` +
        `${catalogue.categories} categories, ${catalogue.products} products, ` +
        `${catalogue.customers} customers and ${catalogue.orders} orders.`,
    );

    if (database.ownerEmail && database.ownerPassword) {
      console.info(
        `Sign in at /northwind/tenants_reg/login as ${database.ownerEmail} ` +
          `with the password ${database.ownerPassword}.`,
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
