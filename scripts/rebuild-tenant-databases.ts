import "dotenv/config";

import { Client } from "pg";

import { prisma } from "@/server/db/prisma";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";

/**
 * Drops every tenant database and provisions it again from the current
 * baseline.
 *
 * This exists because the tenant schema was replaced wholesale rather than
 * migrated: the new ERD renames, removes and re-shapes most tables, and no
 * incremental migration describes that. Rebuilding is the honest answer while
 * the only data in these databases is development data.
 *
 * DESTRUCTIVE. Every row in every tenant database is lost. It refuses to run
 * without `--yes`, and it refuses outright when NODE_ENV is production —
 * neither guard is clever, and both are the kind that has to be there.
 *
 * Run it with `npm run tenant:rebuild -- --yes`.
 */

function adminUrl(): string {
  const url =
    process.env.TENANT_PROVISIONER_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) throw new Error("No provisioner connection is configured.");
  return url;
}

/** Mirrors `isSafeDatabaseName` in provision-database.ts. */
function isSafeDatabaseName(name: string): boolean {
  return /^[a-z_][a-z0-9_]{0,62}$/.test(name);
}

function withDatabase(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function dropDatabase(databaseName: string): Promise<void> {
  const client = new Client({
    connectionString: withDatabase(adminUrl(), "postgres"),
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();

  try {
    // A pooled connection from a running dev server would block the drop.
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to rebuild tenant databases in production.");
  }

  if (!process.argv.includes("--yes")) {
    console.error(
      "This drops every tenant database and everything in it.\n" +
        "Re-run with:  npm run tenant:rebuild -- --yes",
    );
    process.exitCode = 1;
    return;
  }

  const targets = await prisma.tenantDatabase.findMany({
    select: {
      databaseName: true,
      tenant: { select: { id: true, slug: true, businessName: true } },
    },
    orderBy: { databaseName: "asc" },
  });

  if (targets.length === 0) {
    console.info("No tenant databases recorded. Nothing to rebuild.");
    return;
  }

  const failures: string[] = [];

  for (const target of targets) {
    if (!isSafeDatabaseName(target.databaseName)) {
      failures.push(`${target.databaseName}: unsafe name, skipped`);
      continue;
    }

    console.info(`  · dropping ${target.databaseName}`);
    await dropDatabase(target.databaseName);

    // Back to PENDING so the provisioner treats it as new rather than adopting
    // a database that no longer exists.
    await prisma.tenantDatabase.update({
      where: { tenantId: target.tenant.id },
      data: {
        status: "PENDING",
        schemaVersion: null,
        migrationState: "PENDING",
      },
    });

    const result = await provisionDatabaseForTenant(target.tenant.id);

    if (result.ok) {
      console.info(`  ✓ ${target.databaseName} rebuilt`);
    } else {
      failures.push(`${target.databaseName}: ${result.reason}`);
      console.error(`  ✗ ${target.databaseName} — ${result.reason}`);
    }
  }

  console.info(
    `\n${targets.length} tenant database(s): ` +
      `${targets.length - failures.length} rebuilt, ${failures.length} failed.`,
  );

  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
