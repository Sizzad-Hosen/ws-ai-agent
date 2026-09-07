import "dotenv/config";

import { resolveEmbedder } from "@/server/catalog-sync/embed";
import { syncTenantCatalogue } from "@/server/catalog-sync/sync-service";
import { resolveFleet } from "@/server/catalog-sync/tenant-fleet";
import { hasSemanticIndex } from "@/server/catalog-sync/retrieval";
import { prisma } from "@/server/db/prisma";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

/**
 * Bulk-indexes a tenant's catalogue, for onboarding.
 *
 * `npm run sync:backfill -- --tenant=acme`, or every tenant with no argument.
 *
 * Resumable, and cheap to re-run: the work is enqueued as ordinary jobs and
 * drained by the ordinary runner, so a backfill interrupted half way leaves a
 * queue that the next run — or the cron pass — picks up. It also means a
 * product whose content hash has not changed is not re-embedded, so running
 * this against an already-indexed catalogue costs one query per product rather
 * than one embedding call.
 */

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));

  return found ? found.slice(prefix.length) : null;
}

async function main(): Promise<void> {
  const embedder = resolveEmbedder();

  if (!embedder) {
    throw new Error(
      "No embedding provider is configured. Set COHERE_API_KEY and try again.",
    );
  }

  const only = argument("tenant");
  const fleet = await resolveFleet(only);

  if (fleet.members.length === 0) {
    console.log(
      only
        ? `No servable tenant found for "${only}".`
        : "No servable tenants found.",
    );

    for (const entry of fleet.unavailable) {
      console.warn(`  ${entry.slug}: ${entry.reason}`);
    }

    return;
  }

  for (const member of fleet.members) {
    if (!(await hasSemanticIndex(member.tenant.db))) {
      console.warn(
        `${member.slug}: no embedding index in this database — run \`npm run tenant:migrate -- --tenant=${member.slug}\` on a Postgres with pgvector first.`,
      );
      continue;
    }

    const enqueued = await enqueueEveryProduct(member.tenant.db);
    console.log(`${member.slug}: ${enqueued} product(s) queued.`);

    // Drained here rather than left to the cron pass, so a person running a
    // backfill during onboarding sees it finish.
    const report = await syncTenantCatalogue(member.tenant.db, embedder, {
      maxPasses: 1000,
    });

    console.log(
      `${member.slug}: embedded ${report.embedded}, unchanged ${report.skippedUnchanged}, removed ${report.removed}, failed ${report.failed}.`,
    );
  }
}

/**
 * Queues every active product.
 *
 * `ON CONFLICT` is not needed: a duplicate job is harmless because the second
 * one finds the hash already current and finishes without embedding anything.
 * Only active products are queued — an archived product has nothing to be
 * retrieved for, and the runner would only delete its row again.
 */
async function enqueueEveryProduct(db: TenantPrismaClient): Promise<number> {
  return Number(
    await db.$executeRaw`
      INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
      SELECT 'product', "id", 'upsert' FROM "products" WHERE "status" = 'ACTIVE'
    `,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
