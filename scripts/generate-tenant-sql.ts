import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/**
 * Regenerates the tenant provisioning SQL from prisma/tenant/schema.prisma.
 *
 * The schema is defined once, in Prisma, because that is what the tenant
 * client is generated from. Hand-maintaining a parallel SQL file would let the
 * two drift, and the drift would only surface as a runtime error inside a
 * tenant's own database — the worst place to find it.
 */
const OUTPUT = "src/server/tenancy/schema/001_initial.sql";

/**
 * Must match TENANT_SCHEMA_VERSION in src/server/tenancy/provision-database.ts.
 * Bump both when the schema changes.
 */
const VERSION = "2026.09.3";

const HEADER = `-- GENERATED FILE — do not edit by hand.
--
-- Run \`npm run tenant:sql\` after changing prisma/tenant/schema.prisma.
--
-- The tenant database schema, applied by
-- src/server/tenancy/provision-database.ts when an approved registration
-- becomes a tenant. Source of truth for the shape is
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
  const marker = `
-- Records which schema version this database is at, so the provisioner can
-- tell an empty database from a provisioned one without inspecting tables.
CREATE TABLE "schema_migrations" (
    "version" VARCHAR(40) NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);

INSERT INTO "schema_migrations" ("version") VALUES ('${VERSION}');
`;

  writeFileSync(OUTPUT, HEADER + sql + marker, "utf8");
  console.log(`Wrote ${OUTPUT} (${sql.split("\n").length} lines).`);
}

main();
