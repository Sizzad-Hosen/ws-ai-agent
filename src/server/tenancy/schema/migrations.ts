/**
 * The ordered list of tenant schema migrations.
 *
 * Deliberately free of imports so it can be read by the runner, by the
 * provisioner and by a test without pulling in a database driver.
 *
 * `001_initial.sql` is the baseline: the provisioner applies it to an empty
 * database and it records its own marker row. Every file after it is an
 * incremental change applied by `migrateTenantDatabase`, which records the
 * marker itself. Each incremental file must therefore be written to be safe to
 * run twice — `IF NOT EXISTS` throughout — because a database created from a
 * freshly regenerated baseline already contains the change.
 */

export interface TenantMigration {
  /** Recorded in `schema_migrations`. Sorts lexically in apply order. */
  readonly version: string;
  readonly file: string;
}

export const TENANT_MIGRATIONS: readonly TenantMigration[] = [
  { version: "2026.10.1", file: "001_initial.sql" },
];

/** The baseline the provisioner applies to an empty database. */
export const TENANT_BASELINE = TENANT_MIGRATIONS[0]!;

/** The version a fully migrated tenant database is at. */
export const TENANT_SCHEMA_VERSION =
  TENANT_MIGRATIONS[TENANT_MIGRATIONS.length - 1]!.version;

/** Everything after the baseline. These are what the runner applies. */
export const TENANT_INCREMENTAL_MIGRATIONS: readonly TenantMigration[] =
  TENANT_MIGRATIONS.slice(1);

/**
 * The incremental migrations a database has not recorded yet, in apply order.
 *
 * The baseline is deliberately never returned. A database that has any
 * `schema_migrations` row has been provisioned, so its tables exist — and
 * re-running the baseline there fails on the first `CREATE TYPE`. That is not
 * hypothetical: a database provisioned by an older build records a version
 * this list has never heard of, and treating an unrecognised version as "the
 * baseline is missing" is exactly the wrong reading of it.
 *
 * Compares by version rather than by count, so a database that skipped a
 * middle migration still receives it instead of being judged up to date for
 * having the right number of rows.
 */
export function pendingMigrations(
  applied: readonly string[],
): readonly TenantMigration[] {
  const seen = new Set(applied);
  return TENANT_INCREMENTAL_MIGRATIONS.filter(
    (migration) => !seen.has(migration.version),
  );
}

/**
 * True when the database records a baseline this build does not know.
 *
 * Not an error: the incremental migrations are written to be safe to apply
 * anywhere, so they still run. It is worth reporting, because it means the
 * database was built from an older baseline and may differ from a fresh one in
 * ways no migration describes.
 */
export function hasUnknownBaseline(applied: readonly string[]): boolean {
  if (applied.length === 0) return false;

  const known = new Set(
    TENANT_MIGRATIONS.map((migration) => migration.version),
  );
  return !applied.some((version) => known.has(version));
}
