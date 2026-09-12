import "dotenv/config";

import { Client } from "pg";

import { env } from "@/config/env";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import { releaseTenantPrisma } from "@/server/tenancy/tenant-prisma";

/**
 * Two tenants, two databases, and the property the whole architecture exists
 * for: neither can see the other's data.
 *
 * Asserted against real provisioned databases rather than mocks. A mocked
 * isolation test proves the mock is isolated.
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
  const stamp = Date.now().toString(36);
  const a = await createTenant(`verify-iso-a-${stamp}`);
  const b = await createTenant(`verify-iso-b-${stamp}`);

  try {
    const resolvedA = await resolveTenant(a.slug);
    const resolvedB = await resolveTenant(b.slug);

    check(resolvedA.ok, `Tenant A did not resolve.`);
    check(resolvedB.ok, `Tenant B did not resolve.`);
    if (!resolvedA.ok || !resolvedB.ok) return;

    const dbA = resolvedA.tenant.db;
    const dbB = resolvedB.tenant.db;

    check(
      resolvedA.tenant.id !== resolvedB.tenant.id,
      "Two tenants resolved to the same tenant.",
    );

    // ---- a write in A must not appear in B -------------------------------
    const productA = await dbA.product.create({
      data: {
        name: "Tenant A Widget",
        slug: "tenant-a-widget",
        basePrice: "10.00",
        status: "ACTIVE",
      },
    });
    const customerA = await dbA.customer.create({
      data: { name: "Tenant A Customer", email: "a@example.invalid" },
    });

    check(
      (await dbB.product.count()) === 0,
      "Tenant B can see Tenant A's products.",
    );
    check(
      (await dbB.customer.count()) === 0,
      "Tenant B can see Tenant A's customers.",
    );
    check(
      (await dbB.product.findUnique({ where: { id: productA.id } })) === null,
      "Tenant B read Tenant A's product by id.",
    );
    check(
      (await dbB.customer.findUnique({ where: { id: customerA.id } })) === null,
      "Tenant B read Tenant A's customer by id.",
    );

    // ---- and B cannot write over A's rows either --------------------------
    const updated = await dbB.product.updateMany({
      where: { id: productA.id },
      data: { name: "Hijacked" },
    });
    check(updated.count === 0, "Tenant B updated Tenant A's product.");

    const deleted = await dbB.product.deleteMany({
      where: { id: productA.id },
    });
    check(deleted.count === 0, "Tenant B deleted Tenant A's product.");

    const stillThere = await dbA.product.findUnique({
      where: { id: productA.id },
    });
    check(
      stillThere?.name === "Tenant A Widget",
      "Tenant A's product was modified from Tenant B.",
    );

    // ---- the slug is not a credential -------------------------------------
    for (const slug of ["no-such-tenant", "bo", "api", "pricing", ""]) {
      const outcome = await resolveTenant(slug);
      check(
        !outcome.ok && outcome.reason === "unknown-tenant",
        `resolveTenant("${slug}") should have refused.`,
      );
    }

    // A suspended workspace loses its dashboard, not just its storefront.
    await repositories.tenants.updateStatuses(a.tenantId, {
      status: "suspended",
    });
    const suspended = await resolveTenant(a.slug);
    check(
      !suspended.ok && suspended.reason === "tenant-inactive",
      "A suspended tenant still resolved.",
    );
    await repositories.tenants.updateStatuses(a.tenantId, { status: "active" });

    console.log(
      `Tenant isolation verified: ${a.slug} and ${b.slug} provisioned to separate databases; ` +
        `cross-tenant read, update and delete all returned nothing; unknown, reserved and ` +
        `suspended slugs refused. Cleaned up.`,
    );
  } finally {
    await destroy(a);
    await destroy(b);
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
      businessRegion: "US-East-1",
      slug,
      // Approved is the verdict; ACTIVE is the workspace lifecycle. The
      // rebuild keeps them in separate columns, and routing needs both.
      approvalStatus: "APPROVED",
      status: "ACTIVE",
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

  // Nothing in the master database cascades, so every child goes before its
  // parent. The tenant also releases its owner before the owner can be removed.
  const tenantId = fixture.tenantId;

  await prisma.tenantDatabase.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.adminAuditLog.deleteMany({ where: { tenantId } });
  await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: { ownerTenantUserId: null },
  });
  await prisma.tenantUser.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });

  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    // Terminate the pooled tenant connection first; Postgres refuses to drop a
    // database that still has one.
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
