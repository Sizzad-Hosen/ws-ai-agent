import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/**
 * Regenerates the *initial* tenant migration from prisma/tenant/schema.prisma.
 *
 * The schema is defined once, in Prisma, because that is what the tenant
 * client is generated from. Hand-maintaining a parallel SQL file would let the
 * two drift, and the drift would only surface as a runtime error inside a
 * tenant's own database — the worst place to find it.
 *
 * This regenerates 001 only, and 001 is what an empty database gets. Anything
 * after it is a hand-written migration in the same directory — see
 * TENANT_MIGRATIONS — because what those migrations do (extensions, triggers,
 * vector index types) has no Prisma representation to generate from. So do not
 * add a model here expecting this script to migrate existing databases: it
 * cannot, and running it does not touch them.
 */
const OUTPUT = "src/server/tenancy/schema/001_initial.sql";

/**
 * The initial migration's own version, as listed in TENANT_MIGRATIONS in
 * src/server/tenancy/migrate-tenant-database.ts. It is frozen history: a
 * schema change is a *new* migration, not an edit to this one, so this
 * constant should never need to move again.
 */
const VERSION = "2026.09.3";

const HEADER = `-- GENERATED FILE — do not edit by hand.
--
-- Run \`npm run tenant:sql\` after changing prisma/tenant/schema.prisma.
--
-- The initial tenant database schema, applied by
-- src/server/tenancy/migrate-tenant-database.ts to an empty database. Later
-- migrations live beside this file and are hand-written. Source of truth for
-- the shape is
-- docs/db/SaaS Tenant DB — Business + Storefront + AI + WhatsApp.png,
-- transcribed into prisma/tenant/schema.prisma.

`;

function main(): void {
  const sql = execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/tenant/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  // Prisma emits plain CREATE TABLE, so applying this twice fails. The
  // provisioner therefore checks `schema_migrations` before running any of it,
  // and this marker is what it checks. Appended rather than modelled, because a
  // Prisma model for it would be a table the tenant client can write to.
  // The table, but not the row: the migration runner records each version it
  // applies, in the same transaction that applies it. Inserting it here as
  // well would collide on the primary key the moment the runner did its job.
  const marker = `
-- Records which migrations this database has had, so the runner can tell an
-- empty database from a provisioned one, and a current one from one behind.
CREATE TABLE "schema_migrations" (
    "version" VARCHAR(40) NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);
`;

  // Referenced so the version this file documents cannot silently drift from
  // the migration list that owns it.
  void VERSION;

  writeFileSync(OUTPUT, HEADER + sql + marker, "utf8");
  console.log(`Wrote ${OUTPUT} (${sql.split("\n").length} lines).`);
}

main();
