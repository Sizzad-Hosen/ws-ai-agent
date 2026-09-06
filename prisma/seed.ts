/**
 * Development seed for the master database.
 *
 * Seeds configuration only: roles and permissions, the first administrator, the
 * plan catalogue, AI providers and models, and public-site content. There is no
 * fixture business data — no invented tenants, registrations, subscriptions or
 * invoices. Those rows arrive through the application: a visitor applies on
 * `/register`, an administrator approves the application on screen 03, and
 * provisioning creates the tenant. Fixtures made the review queue and the
 * tenants list look populated while hiding the real thing.
 *
 * Every write is an upsert keyed on a natural unique column, so running the
 * seed repeatedly converges rather than duplicating. Each domain lives in its
 * own module under `prisma/seed/`; this file only orders them.
 */

import { prisma } from "./seed/client";
import { seedAdmin } from "./seed/admin";
import { seedAi } from "./seed/ai";
import { seedPlans } from "./seed/plans";
import { seedPublicSite } from "./seed/public-site";
import { seedRbac } from "./seed/rbac";

async function main(): Promise<void> {
  await seedRbac();
  await seedAdmin();
  await seedPlans();
  await seedAi();
  await seedPublicSite();

  console.info(
    "Seed complete: roles, administrator, 3 plans, AI configuration and public-site content. No tenants or registrations — those come from the application.",
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
