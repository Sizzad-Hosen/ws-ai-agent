import "dotenv/config";

import { Client } from "pg";

import { env } from "@/config/env";
import { prisma } from "@/server/db/prisma";
import {
  migrateTenantDatabase,
  TENANT_SCHEMA_VERSION,
} from "@/server/tenancy/migrate-tenant-database";
import { repositories } from "@/server/repositories";

/**
 * Brings existing tenant databases up to the current schema.
 *
 * `npm run tenant:migrate` for every provisioned tenant, or
 * `npm run tenant:migrate -- --tenant=acme` for one. Idempotent: a database
 * already current is reported and left alone.
 *
 * Each database is migrated with the provisioner's administrator credentials,
 * because a migration creates objects and extensions and the application's own
 * connection has no business being able to. That is the same account and the
 * same reasoning as `provision-database.ts`.
 */

interface Target {
  readonly tenantId: string;
  readonly slug: string;
  readonly databaseName: string;
}

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));

  return found ? found.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  const only = argument("tenant");
  const targets = await resolveTargets(only);

  if (targets.length === 0) {
    console.log(
      only
        ? `No provisioned tenant database found for "${only}".`
        : "No provisioned tenant databases.",
    );
    return;
  }

  const adminUrl =
    process.env.TENANT_PROVISIONER_DATABASE_URL ?? env.DATABASE_URL;

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    const client = new Client({
      connectionString: withDatabase(adminUrl, target.databaseName),
      connectionTimeoutMillis: 10_000,
    });

    try {
      await client.connect();
      const outcome = await migrateTenantDatabase(client);

      if (outcome.applied.length > 0) {
        migrated += 1;
        console.log(
          `${target.slug}: applied ${outcome.applied.join(", ")} (now at ${outcome.version}).`,
        );

        // The master row should say what is true of the database, so the back
        // office does not report a version the database does not have.
        await repositories.provisioning.setDatabaseStatus(
          target.tenantId,
          "ready",
          outcome.version ?? TENANT_SCHEMA_VERSION,
        );
      } else {
        console.log(`${target.slug}: already at ${outcome.version}.`);
      }

      for (const entry of outcome.skipped) {
        skipped += 1;
        console.warn(
          `${target.slug}: ${entry.version} skipped — ${entry.reason}.`,
        );
      }
    } catch (error: unknown) {
      failed += 1;
      console.error(
        `${target.slug}: failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  console.log(
    `\n${targets.length} database(s): ${migrated} migrated, ${skipped} migration(s) skipped, ${failed} failed.`,
  );

  if (failed > 0) process.exitCode = 1;
}

async function resolveTargets(only: string | null): Promise<readonly Target[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      ...(only ? { subdomain: only.trim().toLowerCase() } : {}),
      database: { isNot: null },
    },
    select: {
      id: true,
      subdomain: true,
      database: { select: { databaseName: true, status: true } },
    },
    orderBy: { subdomain: "asc" },
  });

  return tenants.flatMap((tenant) =>
    // A database still pending has nothing to migrate; provisioning will run
    // the full list when it creates it. A tenant with no subdomain has no
    // storefront either, but its database is still a database to migrate.
    tenant.database && tenant.database.status !== "PENDING"
      ? [
          {
            tenantId: tenant.id,
            slug: tenant.subdomain ?? tenant.id,
            databaseName: tenant.database.databaseName,
          },
        ]
      : [],
  );
}

function withDatabase(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;

  return parsed.toString();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
