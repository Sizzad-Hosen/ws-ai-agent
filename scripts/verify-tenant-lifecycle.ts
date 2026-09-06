import "dotenv/config";

import { Client } from "pg";

import { env } from "@/config/env";
import { isReservedTenantSlug } from "@/constants/reserved-slugs";
import { allChecksPassed } from "@/features/registrations/types";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { TENANT_SCHEMA_VERSION } from "@/server/tenancy/provision-database";
import { releaseTenantPrisma } from "@/server/tenancy/tenant-prisma";
import { REGISTRATION_CHECK_TYPES } from "@/types/status";

/**
 * The whole path a business takes: public sign-up, the review queue, approval,
 * a real database, and a reachable storefront.
 *
 * Every step is checked against the database rather than the UI, and everything
 * it creates — registration, tenant, subscription and the physical database —
 * is removed at the end, so the console is left exactly as it was found.
 */

const EMAIL = "verify-lifecycle@example.invalid";

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

async function main(): Promise<void> {
  const reviewer = await prisma.adminUser.findFirst({ select: { id: true } });
  if (!reviewer) throw new Error("No administrator exists to review with.");

  // ---- a visitor applies -------------------------------------------------
  const code = await repositories.registrations.create({
    businessName: "Verify Lifecycle Ltd",
    ownerName: "Verify Owner",
    ownerEmail: EMAIL,
    ownerPhone: "+1 555 000 0000",
    industry: "Testing",
    region: "US-East-1",
    requestedPlanId: null,
  });

  const created = await prisma.tenantRegistration.findUniqueOrThrow({
    where: { registrationCode: code },
    select: { id: true },
  });
  const registrationId = created.id;
  let tenantId: string | null = null;
  let databaseName: string | null = null;

  try {
    // ---- it reaches the queue, and the tenants screen ---------------------
    const queue = await repositories.registrations.findMany({
      status: "pending_review",
      limit: 50,
    });
    const queued = queue.items.find(
      (item) => item.registration.id === registrationId,
    );

    check(queued !== undefined, "The application never reached the queue.");
    check(queued!.checks.length === 3, "The review checklist was not created.");
    check(
      !allChecksPassed(queued!.checks),
      "A new application arrived already approvable.",
    );

    // ---- a reviewer works the checklist ----------------------------------
    for (const checkType of REGISTRATION_CHECK_TYPES) {
      const outcome = await repositories.registrations.recordCheck({
        registrationId,
        checkType,
        status: "passed",
        notes: null,
        reviewerId: reviewer.id,
      });
      check(outcome.ok, `Could not record ${checkType}.`);
    }

    const reviewed =
      await repositories.registrations.findDetailById(registrationId);
    check(
      reviewed !== null && allChecksPassed(reviewed.checks),
      "Recording every check did not make the application approvable.",
    );

    // ---- approval provisions the tenant ----------------------------------
    const plan = (await repositories.plans.findAll())
      .map((item) => item.plan)
      .find((item) => item.isActive && item.monthlyPrice !== null);
    check(plan !== undefined, "No priced plan is available to assign.");

    const provisioned = await repositories.provisioning.provisionApprovedTenant(
      {
        registrationId,
        planId: plan!.id,
        priceSnapshot: plan!.monthlyPrice!,
        currency: plan!.currency,
        rootDomain: env.TENANT_ROOT_DOMAIN,
        appUrl: env.NEXT_PUBLIC_APP_URL,
        region: "US-East-1",
      },
    );

    check(provisioned.ok, "Approval did not provision a tenant.");
    if (!provisioned.ok) return;

    tenantId = provisioned.tenant.tenantId;
    databaseName = provisioned.tenant.databaseName;

    check(
      !isReservedTenantSlug(provisioned.tenant.subdomain),
      `Provisioning handed out the reserved slug "${provisioned.tenant.subdomain}".`,
    );
    check(
      provisioned.tenant.websiteUrl ===
        `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/${provisioned.tenant.subdomain}`,
      `Site URL is not the path this application serves: ${provisioned.tenant.websiteUrl}`,
    );

    // ---- the physical database really exists -----------------------------
    const database = await provisionDatabaseForTenant(tenantId);
    check(
      database.ok,
      `Database provisioning failed: ${JSON.stringify(database)}`,
    );

    const target = await repositories.provisioning.findDatabaseTarget(tenantId);
    check(
      target?.status === "ready",
      `Database status is ${target?.status ?? "missing"}, expected ready.`,
    );

    await assertTenantSchema(databaseName);

    // ---- and its storefront resolves --------------------------------------
    const site = await repositories.tenants.findSiteBySubdomain(
      provisioned.tenant.subdomain,
    );

    check(site !== null, "The tenant storefront does not resolve by slug.");
    check(
      site!.businessName === "Verify Lifecycle Ltd",
      "The storefront resolved to the wrong tenant.",
    );
    check(
      site!.databaseStatus === "ready",
      "The storefront does not see its database as ready.",
    );
    // The storefront is anonymous, so it must not carry anything privileged.
    check(
      !JSON.stringify(site).includes("secret"),
      "The storefront DTO carries a secret reference.",
    );

    check(
      (await repositories.tenants.findSiteBySubdomain("no-such-tenant")) ===
        null,
      "An unknown slug resolved to a tenant.",
    );

    console.log(
      `Tenant lifecycle verified: ${code} queued with 3 checks, approved to ${provisioned.tenant.tenantCode}, database ${databaseName} created with schema ${TENANT_SCHEMA_VERSION}, storefront at ${provisioned.tenant.websiteUrl}. Cleaned up.`,
    );
  } finally {
    await cleanUp(registrationId, tenantId, databaseName);
  }
}

/** Proves the schema was applied, not just that the database exists. */
async function assertTenantSchema(databaseName: string): Promise<void> {
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${databaseName}`;

  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  try {
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const found = new Set(tables.rows.map((row) => row.tablename));

    // Every table on the tenant ERD, so a partially applied schema fails here
    // rather than at the first query in production.
    for (const expected of [
      "users",
      "roles",
      "user_roles",
      "permissions",
      "role_permissions",
      "customers",
      "addresses",
      "categories",
      "products",
      "product_variants",
      "inventory",
      "carts",
      "cart_items",
      "orders",
      "order_items",
      "order_payments",
      "reviews",
      "whatsapp_accounts",
      "contacts",
      "conversations",
      "messages",
      "webhook_events",
      "tenant_ai_configurations",
      "ai_usage_logs",
      "store_settings",
      "schema_migrations",
    ]) {
      check(found.has(expected), `Tenant database is missing "${expected}".`);
    }

    const version = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations",
    );
    check(
      version.rows[0]?.version === TENANT_SCHEMA_VERSION,
      "Tenant database does not record the schema version.",
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function cleanUp(
  registrationId: string,
  tenantId: string | null,
  databaseName: string | null,
): Promise<void> {
  if (tenantId) {
    // Provisioning opens a pooled connection to seed the owner user, so the
    // pool must be closed before Postgres will drop the database.
    await releaseTenantPrisma(tenantId);

    await prisma.invoice.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }

  await prisma.tenantRegistration.deleteMany({ where: { id: registrationId } });

  if (databaseName) {
    const url = new URL(env.DATABASE_URL);
    url.pathname = "/postgres";

    const client = new Client({ connectionString: url.toString() });
    await client.connect();
    try {
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [databaseName],
      );
      await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
