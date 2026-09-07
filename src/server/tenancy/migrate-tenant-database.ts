import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Client } from "pg";

/**
 * Bringing a tenant database up to the current schema.
 *
 * Provisioning used to apply one generated create-script and refuse anything
 * else: a database at an older version was told to be recreated, because
 * re-running `CREATE TABLE` against objects that exist fails on the first one
 * and leaves the database half-built. That was tolerable while the schema was
 * new and every tenant database was disposable. It stops being tolerable the
 * moment a tenant has data in one.
 *
 * So migrations are now a list, applied in order, each recorded in
 * `schema_migrations` inside the same transaction that applies it. A database
 * is at whatever set of versions that table says it is at, and this walks the
 * difference. Two consequences worth knowing:
 *
 *  - The initial migration is generated from `prisma/tenant/schema.prisma`
 *    (`npm run tenant:sql`) and is frozen history. Later migrations are
 *    hand-written, because what they mostly do — extensions, triggers, index
 *    types Prisma has no syntax for — cannot be expressed in a Prisma schema.
 *  - Nothing here is `IF NOT EXISTS`. A migration that half-applied should
 *    fail loudly on the next attempt rather than quietly report success over a
 *    database that is missing half of it.
 */

export interface TenantMigration {
  /** Recorded in `schema_migrations`; the identity of this migration. */
  readonly version: string;
  readonly file: string;
  readonly describes: string;
  /**
   * A Postgres extension this migration cannot run without.
   *
   * Where the extension is unavailable the migration is skipped and *not*
   * recorded, so the database stays behind and picks it up the next time it is
   * migrated on a server that has it. Skipping is reported, never silent: the
   * alternative — failing provisioning outright — would make the whole
   * application unusable on a Postgres without pgvector, including every part
   * of it that has nothing to do with embeddings.
   */
  readonly requiresExtension?: string;
}

/**
 * Every migration, oldest first. Append only — an applied version is history,
 * and editing one leaves databases that ran the old text claiming the new.
 */
export const TENANT_MIGRATIONS: readonly TenantMigration[] = [
  {
    version: "2026.09.3",
    file: "001_initial.sql",
    describes:
      "The tenant schema as generated from prisma/tenant/schema.prisma.",
  },
  {
    version: "2026.09.4",
    file: "002_catalog_embeddings.sql",
    describes:
      "pgvector, the catalogue embedding index, and the triggers that keep it converged.",
    requiresExtension: "vector",
  },
];

/** The version a fully migrated tenant database reports. */
export const TENANT_SCHEMA_VERSION =
  TENANT_MIGRATIONS[TENANT_MIGRATIONS.length - 1].version;

const SCHEMA_DIRECTORY = "src/server/tenancy/schema";

export interface MigrationOutcome {
  /** Versions applied by this call, in order. Empty when already current. */
  readonly applied: readonly string[];
  /** Versions this server cannot apply, with the reason. */
  readonly skipped: readonly SkippedMigration[];
  /** True when the database had no `schema_migrations` table at all. */
  readonly wasEmpty: boolean;
  /** The newest version this database now reports, or null when unmigrated. */
  readonly version: string | null;
}

export interface SkippedMigration {
  readonly version: string;
  readonly reason: string;
}

/**
 * Applies whatever this database has not had yet.
 *
 * Safe to call on a fresh database, a current one, or one several versions
 * behind. The client must be connected to the tenant database itself, with
 * rights to create objects in it.
 */
export async function migrateTenantDatabase(
  client: Client,
): Promise<MigrationOutcome> {
  const already = await appliedVersions(client);
  const applied: string[] = [];
  const skipped: SkippedMigration[] = [];

  for (const migration of TENANT_MIGRATIONS) {
    if (already.has(migration.version)) continue;

    if (
      migration.requiresExtension &&
      !(await extensionAvailable(client, migration.requiresExtension))
    ) {
      skipped.push({
        version: migration.version,
        reason: `the "${migration.requiresExtension}" extension is not available on this server`,
      });
      continue;
    }

    const sql = await readFile(
      path.join(process.cwd(), SCHEMA_DIRECTORY, migration.file),
      "utf8",
    );

    // The migration and the record of it commit together, so a failure cannot
    // leave a database claiming a version it does not have.
    await client.query("BEGIN");

    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "schema_migrations" ("version") VALUES ($1)`,
        [migration.version],
      );
      await client.query("COMMIT");
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new Error(
        `Tenant migration ${migration.file} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    applied.push(migration.version);
    already.add(migration.version);
  }

  return {
    applied,
    skipped,
    wasEmpty: already.size === applied.length,
    version: newest(already),
  };
}

/**
 * The migrations this database still needs and this server can supply.
 *
 * What "up to date" means, for anything that wants to assert it: a database is
 * current when this is empty, which is true on a server without pgvector as
 * well as on one with it.
 */
export async function pendingTenantMigrations(
  client: Client,
): Promise<readonly TenantMigration[]> {
  const already = await appliedVersions(client);
  const pending: TenantMigration[] = [];

  for (const migration of TENANT_MIGRATIONS) {
    if (already.has(migration.version)) continue;

    if (
      migration.requiresExtension &&
      !(await extensionAvailable(client, migration.requiresExtension))
    ) {
      continue;
    }

    pending.push(migration);
  }

  return pending;
}

async function extensionAvailable(
  client: Client,
  name: string,
): Promise<boolean> {
  const result = await client
    .query(`SELECT 1 FROM pg_available_extensions WHERE name = $1`, [name])
    .catch(() => null);

  return (result?.rowCount ?? 0) > 0;
}

/** The newest version in a set, by the order the migration list declares. */
function newest(versions: ReadonlySet<string>): string | null {
  let found: string | null = null;

  for (const migration of TENANT_MIGRATIONS) {
    if (versions.has(migration.version)) found = migration.version;
  }

  return found;
}

/**
 * What this database has already had applied.
 *
 * A missing `schema_migrations` table means a fresh database rather than an
 * error: that is exactly the state the first migration exists to leave behind.
 * The query is wrapped in its own transaction so a failed lookup does not
 * poison the session for the migration that follows it.
 */
async function appliedVersions(client: Client): Promise<Set<string>> {
  const result = await client
    .query<{ version: string }>(`SELECT version FROM "schema_migrations"`)
    .catch(() => null);

  return new Set(result?.rows.map((row) => row.version) ?? []);
}
