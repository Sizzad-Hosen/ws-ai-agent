import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { migrateTenantDatabase } from "@/server/tenancy/migrate-tenant";
import { TENANT_SCHEMA_VERSION } from "@/server/tenancy/schema/migrations";

/**
 * Brings every provisioned tenant database up to the current schema version.
 *
 * Tenant databases are not migrated by `prisma migrate` — there is one per
 * tenant and Prisma has no notion of that — so this sweeps them. It reads the
 * list from the master `tenant_databases` table, which is the only place that
 * knows they exist.
 *
 * Idempotent, and safe to run while the application is up: each migration is
 * written to be applied twice without effect. A failure on one tenant does not
 * stop the others; the summary at the end names every database that failed.
 *
 * Run it with `npm run tenant:migrate`.
 */

async function main(): Promise<void> {
  const targets = await prisma.tenantDatabase.findMany({
    // A row still PENDING or FAILED has no database to migrate.
    where: { status: "READY" },
    select: {
      databaseName: true,
      schemaVersion: true,
      tenant: { select: { id: true, slug: true } },
    },
    orderBy: { databaseName: "asc" },
  });

  if (targets.length === 0) {
    console.info("No provisioned tenant databases to migrate.");
    return;
  }

  const failures: string[] = [];
  let changed = 0;
  let alreadyCurrent = 0;

  for (const target of targets) {
    const result = await migrateTenantDatabase(target.databaseName);

    if (!result.ok) {
      failures.push(`${target.databaseName}: ${result.reason}`);
      console.error(`  ✗ ${target.databaseName} — ${result.reason}`);
      continue;
    }

    if (result.unknownBaseline) {
      console.warn(
        `  ! ${target.databaseName} was built from a baseline this build does not list ` +
          `(recorded ${target.schemaVersion ?? "nothing"}). Incremental migrations still applied.`,
      );
    }

    if (result.applied.length === 0) {
      alreadyCurrent += 1;
      console.info(`  · ${target.databaseName} already at ${result.version}`);
    } else {
      changed += 1;
      console.info(
        `  ✓ ${target.databaseName} applied ${result.applied.join(", ")}`,
      );
    }

    // The master row records what the tenant database is at, and the tenant
    // list reads it. Leaving it stale would make a migrated tenant look
    // outdated to the back office.
    await prisma.tenantDatabase.update({
      where: { tenantId: target.tenant.id },
      data: { schemaVersion: result.version, migrationState: "APPLIED" },
    });
  }

  console.info(
    `\n${targets.length} tenant database(s): ${changed} migrated, ` +
      `${alreadyCurrent} already at ${TENANT_SCHEMA_VERSION}, ` +
      `${failures.length} failed.`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
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
