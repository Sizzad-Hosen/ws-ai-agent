/**
 * Development seed for the master database.
 *
 * Every write is an upsert keyed on a natural unique column, so running the
 * seed repeatedly converges rather than duplicating. Each domain lives in its
 * own module under `prisma/seed/`; this file only orders them.
 *
 * The order below is a dependency order, not a preference: registrations and
 * tenants both reference plans, and registrations record the administrator who
 * reviewed them.
 */

import { prisma } from "./seed/client";
import { seedAdmin } from "./seed/admin";
import { seedAi } from "./seed/ai";
import { seedPlans } from "./seed/plans";
import { seedPublicSite } from "./seed/public-site";
import { seedRbac } from "./seed/rbac";
import { seedRegistrations } from "./seed/registrations";
import { TENANT_SEEDS, seedTenants } from "./seed/tenants";

async function main(): Promise<void> {
  await seedRbac();

  const admin = await seedAdmin();

  const plans = await seedPlans();
  const planIds = {
    starter: plans.starter.id,
    business: plans.business.id,
    enterprise: plans.enterprise.id,
  };

  await seedTenants(planIds);
  await seedRegistrations(planIds, admin.id);
  await seedAi();
  await seedPublicSite();

  console.info(
    `Seed complete: ${TENANT_SEEDS.length} tenants, 3 plans, 3 registrations, AI configuration and public-site content.`,
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
