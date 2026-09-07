import "dotenv/config";

import { buildEmbeddableText } from "@/server/catalog-sync/build-text";
import { resolveEmbedder } from "@/server/catalog-sync/embed";
import { hasSemanticIndex } from "@/server/catalog-sync/retrieval";
import { syncTenantCatalogue } from "@/server/catalog-sync/sync-service";
import { resolveFleet } from "@/server/catalog-sync/tenant-fleet";
import { prisma } from "@/server/db/prisma";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

/**
 * Diffs the catalogue against its index and, unless asked not to, fixes it.
 *
 * `npm run sync:reconcile -- --tenant=acme [--dry-run]`
 *
 * Triggers plus a job runner should keep the two converged on their own. This
 * exists because "should" is not "does": a migration applied while the app was
 * down, a restore from backup, a `COPY` into `products`, a run of failed jobs
 * nobody noticed — each leaves a drift that no future write will heal, because
 * nothing will write those rows again. Three shapes of drift are possible and
 * all three are reported by name:
 *
 *   missing   — an active product with no embedding row
 *   stale     — an embedding whose content_hash is not the product's current one
 *   orphaned  — an embedding for a product that is gone or no longer active
 *
 * The fix is to enqueue, never to write vectors directly: one code path
 * embeds, and it is the one the triggers feed.
 */

interface Drift {
  readonly missing: readonly string[];
  readonly stale: readonly string[];
  readonly orphaned: readonly string[];
}

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));

  return found ? found.slice(prefix.length) : null;
}

const dryRun = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const only = argument("tenant");
  const fleet = await resolveFleet(only);

  if (fleet.members.length === 0) {
    console.log(
      only ? `No servable tenant found for "${only}".` : "No servable tenants.",
    );
    return;
  }

  let totalDrift = 0;

  for (const member of fleet.members) {
    if (!(await hasSemanticIndex(member.tenant.db))) {
      console.warn(`${member.slug}: no embedding index in this database.`);
      continue;
    }

    const drift = await findDrift(member.tenant.db);
    const count =
      drift.missing.length + drift.stale.length + drift.orphaned.length;
    totalDrift += count;

    console.log(
      `${member.slug}: ${drift.missing.length} missing, ${drift.stale.length} stale, ${drift.orphaned.length} orphaned.`,
    );

    if (count === 0 || dryRun) continue;

    await repair(member.tenant.db, drift);

    const embedder = resolveEmbedder();

    if (!embedder) {
      console.warn(
        `${member.slug}: queued ${count} fix(es), but no embedding provider is configured to run them.`,
      );
      continue;
    }

    const report = await syncTenantCatalogue(member.tenant.db, embedder, {
      maxPasses: 1000,
    });

    console.log(
      `${member.slug}: repaired — embedded ${report.embedded}, removed ${report.removed}, failed ${report.failed}.`,
    );
  }

  if (dryRun && totalDrift > 0) {
    console.log(
      `\n${totalDrift} row(s) would be fixed. Re-run without --dry-run.`,
    );
  }
}

/**
 * The three drifts, computed by comparing hashes.
 *
 * Stale detection recomputes each product's canonical text rather than
 * trusting a timestamp: a hash comparison is the same check the runner makes,
 * so this cannot disagree with it about whether a row is current.
 */
async function findDrift(db: TenantPrismaClient): Promise<Drift> {
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      attributes: true,
      categoryId: true,
      variants: { where: { isActive: true }, select: { sku: true } },
      category: { select: { name: true, parentId: true } },
    },
  });

  const indexed = new Map(
    (
      await db.$queryRaw<{ product_id: string; content_hash: string }[]>`
        SELECT "product_id"::text, "content_hash" FROM "product_embeddings"
      `
    ).map((row) => [row.product_id, row.content_hash]),
  );

  const missing: string[] = [];
  const stale: string[] = [];

  for (const product of products) {
    const current = indexed.get(product.id);

    if (current === undefined) {
      missing.push(product.id);
      continue;
    }

    // The category path is walked per product here rather than batched: this
    // runs on a schedule, not in a request, and being obviously correct is
    // worth more than being fast.
    const { contentHash } = buildEmbeddableText({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      attributes: product.attributes,
      categoryPath: await categoryPath(db, product.categoryId),
      skus: product.variants.map((variant) => variant.sku),
    });

    if (contentHash !== current) stale.push(product.id);
  }

  const live = new Set(products.map((product) => product.id));
  const orphaned = [...indexed.keys()].filter((id) => !live.has(id));

  return { missing, stale, orphaned };
}

/** Root-first category names, walked up from a leaf. */
async function categoryPath(
  db: TenantPrismaClient,
  categoryId: string | null,
): Promise<readonly string[]> {
  const path: string[] = [];
  let cursor = categoryId;

  // Bounded, so a tree that has somehow acquired a cycle cannot hang this.
  for (let depth = 0; cursor !== null && depth < 50; depth += 1) {
    const category: { name: string; parentId: string | null } | null =
      await db.category.findUnique({
        where: { id: cursor },
        select: { name: true, parentId: true },
      });

    if (!category) break;

    path.unshift(category.name);
    cursor = category.parentId;
  }

  return path;
}

async function repair(db: TenantPrismaClient, drift: Drift): Promise<void> {
  const upserts = [...drift.missing, ...drift.stale];

  if (upserts.length > 0) {
    await db.$executeRaw`
      INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
      SELECT 'product', "id"::uuid, 'upsert'
      FROM unnest(${upserts}::text[]) AS t("id")
    `;
  }

  if (drift.orphaned.length > 0) {
    await db.$executeRaw`
      INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
      SELECT 'product', "id"::uuid, 'delete'
      FROM unnest(${drift.orphaned}::text[]) AS t("id")
    `;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
