/**
 * Development seed for the master database.
 *
 * Every write is an upsert keyed on a natural unique column, so the seed
 * converges rather than duplicating. Run it twice and the second run changes
 * nothing. `npm run db:reset` drops the database, replays the migrations and
 * runs this file.
 *
 * It seeds configuration — the administrator, the plan catalogue, AI providers,
 * feature flags and platform settings — plus two fixtures the back office
 * cannot be reviewed without: one approved tenant and one submitted
 * registration. Nothing else is invented.
 *
 * The seeded registration stays unapproved on purpose. Approving it is the
 * manual walkthrough, and it is the only path that creates a second tenant.
 */
import { prisma } from "./seed/client";
import { seedAdmin } from "./seed/admin";
import { seedAi } from "./seed/ai";
import { seedPlans } from "./seed/plans";
import { seedPlatform } from "./seed/platform";
import { seedRegistration } from "./seed/registrations";
import { seedTenant } from "./seed/tenants";

async function main(): Promise<void> {
  const admin = await seedAdmin();
  const plans = await seedPlans();
  await seedAi();
  await seedPlatform();

  const business = plans["business"];
  const starter = plans["starter"];
  if (business === undefined || starter === undefined) {
    throw new Error("The plan catalogue did not seed the expected codes.");
  }

  await seedTenant(business, admin.id);
  await seedRegistration(starter);

  console.info(
    "Seed complete: 1 administrator, 3 plans, 3 AI providers, 3 feature flags, " +
      "6 platform settings, 1 approved tenant with a database, owner and active " +
      "subscription, and 1 submitted registration with 3 pending checks.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
