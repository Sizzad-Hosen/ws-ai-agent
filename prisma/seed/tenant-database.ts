/**
 * The seeded tenant's *physical* database.
 *
 * `seedTenant` writes master rows only. Until this step runs, the
 * `tenant_databases` row for Northwind holds placeholder pointers — a
 * `secret://` reference no provider resolves and a database that does not
 * exist — so `resolveTenant("northwind")` fails with `secret-unavailable` and
 * the workspace cannot be signed into at all.
 *
 * This calls the same `provisionDatabaseForTenant` the approval flow calls, so
 * the seeded tenant is provisioned the way a real one is rather than by a
 * second code path that could drift from it. That function creates the
 * database, applies `src/server/tenancy/schema/001_initial.sql`, rewrites the
 * pointers to the local provisioner, marks the row READY and seeds the owner's
 * user account.
 *
 * Idempotent: an existing database is adopted, and an existing owner keeps the
 * password they may already have changed.
 */
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";

export interface SeededTenantDatabase {
  readonly ready: boolean;
  readonly databaseName: string | null;
  /** Only ever non-null the first time, when the account is created. */
  readonly ownerEmail: string | null;
  readonly ownerPassword: string | null;
}

export async function seedTenantDatabase(
  tenantId: string,
): Promise<SeededTenantDatabase> {
  const result = await provisionDatabaseForTenant(tenantId);

  if (!result.ok) {
    // Not fatal to the seed: the master database is still correct and the back
    // office still renders. Only the tenant workspace is unreachable, and the
    // reason has to be visible rather than swallowed.
    console.warn(
      `Tenant database provisioning failed: ${result.reason}\n` +
        "The back office is seeded, but the tenant workspace cannot be opened.",
    );
    return {
      ready: false,
      databaseName: null,
      ownerEmail: null,
      ownerPassword: null,
    };
  }

  return {
    ready: true,
    databaseName: result.databaseName,
    ownerEmail: result.ownerEmail,
    ownerPassword: result.ownerPassword,
  };
}
