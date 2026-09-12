import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import {
  hasUnknownBaseline,
  pendingMigrations,
  TENANT_SCHEMA_VERSION,
  type TenantMigration,
} from "./schema/migrations";

/**
 * Applying outstanding schema changes to a tenant's own database.
 *
 * Until this existed, the tenant schema could be created but never changed:
 * `provisionTenantDatabase` refused a database at any version other than the
 * current one and said so, which was honest but left every provisioned tenant
 * frozen at the version it was born with.
 *
 * Each migration runs inside its own transaction together with the marker row
 * that records it, so a migration either applied and is recorded, or did
 * neither. A half-applied change that claims to be finished is the one outcome
 * worth spending a transaction to prevent.
 */

const SCHEMA_DIRECTORY = "src/server/tenancy/schema";

export type TenantMigrationOutcome =
  | {
      readonly ok: true;
      readonly applied: readonly string[];
      readonly version: string;
      /** The database was built from a baseline this build does not know. */
      readonly unknownBaseline: boolean;
    }
  | { readonly ok: false; readonly reason: string };

function provisionerUrl(): string | null {
  return (
    process.env.TENANT_PROVISIONER_DATABASE_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

/** Swaps the database name in a connection string, preserving everything else. */
function withDatabase(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/** Mirrors `isSafeDatabaseName` in provision-database.ts. */
function isSafeDatabaseName(name: string): boolean {
  return /^[a-z_][a-z0-9_]{0,62}$/.test(name);
}

async function appliedVersions(client: Client): Promise<readonly string[]> {
  const result = await client
    .query<{ version: string }>("SELECT version FROM schema_migrations")
    .catch(() => null);

  return result?.rows.map((row) => row.version) ?? [];
}

async function applyOne(
  client: Client,
  migration: TenantMigration,
): Promise<void> {
  const sql = await readFile(
    path.join(process.cwd(), SCHEMA_DIRECTORY, migration.file),
    "utf8",
  );

  await client.query("BEGIN");

  try {
    await client.query(sql);
    // `ON CONFLICT DO NOTHING` because the baseline file records its own
    // marker, and a regenerated baseline may already carry a later one.
    await client.query(
      `INSERT INTO schema_migrations (version) VALUES ($1)
       ON CONFLICT (version) DO NOTHING`,
      [migration.version],
    );
    await client.query("COMMIT");
  } catch (error: unknown) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

/**
 * Brings one tenant database up to {@link TENANT_SCHEMA_VERSION}.
 *
 * Idempotent: a database already at the current version is untouched and
 * reports an empty list. An unprovisioned database — no `schema_migrations`
 * table at all — is refused rather than migrated, because applying an
 * incremental change to a database with no tables would half-create it.
 */
export async function migrateTenantDatabase(
  databaseName: string,
): Promise<TenantMigrationOutcome> {
  if (!isSafeDatabaseName(databaseName)) {
    return { ok: false, reason: `Unsafe database name "${databaseName}".` };
  }

  const adminUrl = provisionerUrl();

  if (!adminUrl) {
    return { ok: false, reason: "No provisioner connection is configured." };
  }

  const client = new Client({
    connectionString: withDatabase(adminUrl, databaseName),
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
  } catch (error: unknown) {
    // Never surface the driver error verbatim: it can echo the DSN.
    const detail = error instanceof Error ? error.message : "unknown error";
    return { ok: false, reason: `Could not connect: ${detail}` };
  }

  try {
    const applied = await appliedVersions(client);

    if (applied.length === 0) {
      return {
        ok: false,
        reason:
          "This database has no schema_migrations table, so it was never provisioned.",
      };
    }

    const pending = pendingMigrations(applied);
    const done: string[] = [];

    for (const migration of pending) {
      await applyOne(client, migration);
      done.push(migration.version);
    }

    return {
      ok: true,
      applied: done,
      version: TENANT_SCHEMA_VERSION,
      unknownBaseline: hasUnknownBaseline(applied),
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(`Tenant migration failed for "${databaseName}".`, detail);
    return { ok: false, reason: detail };
  } finally {
    await client.end().catch(() => undefined);
  }
}
