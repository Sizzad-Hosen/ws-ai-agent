import "server-only";

import { Prisma } from "@/generated/tenant";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import { buildEmbeddableText, type EmbeddableProduct } from "./build-text";
import {
  chunk,
  EMBEDDING_BATCH_SIZE,
  toVectorLiteral,
  type Embedder,
} from "./embed";

/**
 * The job runner: what makes the index converge on the catalogue.
 *
 * Triggers enqueue; this drains. Everything about it assumes it may be running
 * more than once at a time — Vercel will happily invoke the cron route while a
 * previous invocation is still going — so work is *claimed*, not read:
 * `FOR UPDATE SKIP LOCKED` hands each row to exactly one runner and lets the
 * others walk past it rather than block.
 *
 * Raw SQL throughout. The embeddings tables are absent from the Prisma schema
 * (Prisma has no `vector` type), and the claim loop needs SKIP LOCKED, which
 * Prisma's query builder cannot express either. Every statement runs on the
 * tenant's own client, so the tenant scoping is the connection, as everywhere
 * else in this codebase.
 */

export interface SyncOptions {
  /** Rows claimed per pass. */
  readonly batchSize?: number;
  /** Passes before returning, so one invocation cannot run forever. */
  readonly maxPasses?: number;
}

export interface SyncReport {
  readonly claimed: number;
  readonly embedded: number;
  readonly skippedUnchanged: number;
  readonly removed: number;
  readonly failed: number;
}

interface ClaimedJob {
  readonly id: string;
  readonly entity: "product" | "category";
  readonly entity_id: string;
  readonly op: "upsert" | "delete";
  readonly attempts: number;
}

const DEFAULT_BATCH = 50;
const DEFAULT_PASSES = 10;
/** After this, a job is failed rather than retried. */
const MAX_ATTEMPTS = 5;
/** A job claimed longer ago than this belonged to a runner that died. */
const STUCK_AFTER_MINUTES = 10;

export async function syncTenantCatalogue(
  db: TenantPrismaClient,
  embedder: Embedder,
  options: SyncOptions = {},
): Promise<SyncReport> {
  const batchSize = Math.min(
    options.batchSize ?? DEFAULT_BATCH,
    EMBEDDING_BATCH_SIZE * 2,
  );
  const maxPasses = options.maxPasses ?? DEFAULT_PASSES;

  const report = {
    claimed: 0,
    embedded: 0,
    skippedUnchanged: 0,
    removed: 0,
    failed: 0,
  };

  await releaseStuckJobs(db);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const jobs = await claim(db, batchSize);

    if (jobs.length === 0) break;

    report.claimed += jobs.length;

    const outcome = await runJobs(db, embedder, jobs);

    report.embedded += outcome.embedded;
    report.skippedUnchanged += outcome.skippedUnchanged;
    report.removed += outcome.removed;
    report.failed += outcome.failed;
  }

  return report;
}

/**
 * Takes ownership of up to `limit` pending jobs.
 *
 * One statement, so the select and the status change cannot be separated by
 * another runner. The rows this one locks are invisible to the others because
 * of SKIP LOCKED, which is the whole reason concurrent invocations are safe
 * rather than merely unlikely to collide.
 */
async function claim(
  db: TenantPrismaClient,
  limit: number,
): Promise<readonly ClaimedJob[]> {
  return db.$queryRaw<ClaimedJob[]>`
    WITH claimed AS (
      SELECT "id"
      FROM "embedding_jobs"
      WHERE "status" = 'pending' AND "run_after" <= NOW()
      ORDER BY "run_after", "id"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "embedding_jobs" AS j
    SET "status" = 'running',
        "locked_at" = NOW(),
        "attempts" = j."attempts" + 1
    FROM claimed
    WHERE j."id" = claimed."id"
    RETURNING j."id"::text, j."entity"::text, j."entity_id"::text, j."op"::text, j."attempts"
  `;
}

/**
 * Returns jobs a dead runner left claimed.
 *
 * A process killed mid-batch leaves rows `running` forever, and a queue that
 * silently stops draining is worse than one that retries too eagerly.
 */
async function releaseStuckJobs(db: TenantPrismaClient): Promise<void> {
  await db.$executeRaw`
    UPDATE "embedding_jobs"
    SET "status" = 'pending', "locked_at" = NULL
    WHERE "status" = 'running'
      AND "locked_at" < NOW() - (${STUCK_AFTER_MINUTES} * INTERVAL '1 minute')
  `;
}

interface JobsOutcome {
  embedded: number;
  skippedUnchanged: number;
  removed: number;
  failed: number;
}

async function runJobs(
  db: TenantPrismaClient,
  embedder: Embedder,
  jobs: readonly ClaimedJob[],
): Promise<JobsOutcome> {
  const outcome: JobsOutcome = {
    embedded: 0,
    skippedUnchanged: 0,
    removed: 0,
    failed: 0,
  };

  const deletions = jobs.filter((job) => job.op === "delete");
  const upserts = jobs.filter((job) => job.op === "upsert");

  for (const job of deletions) {
    try {
      await removeEmbedding(db, job.entity_id);
      await finish(db, job.id);
      outcome.removed += 1;
    } catch (error: unknown) {
      await fail(db, job, error);
      outcome.failed += 1;
    }
  }

  if (upserts.length === 0) return outcome;

  // Products that no longer exist, are no longer active, or have no variants
  // are not embedded — they are removed. A deactivated product that stayed in
  // the index would keep being retrieved and then filtered out at query time,
  // which is a slower way of not selling it.
  const loaded = await loadProducts(
    db,
    upserts.map((job) => job.entity_id),
  );

  for (const job of upserts) {
    if (!loaded.has(job.entity_id)) {
      try {
        await removeEmbedding(db, job.entity_id);
        await finish(db, job.id);
        outcome.removed += 1;
      } catch (error: unknown) {
        await fail(db, job, error);
        outcome.failed += 1;
      }
    }
  }

  const pending: { job: ClaimedJob; text: string; hash: string }[] = [];

  for (const job of upserts) {
    const product = loaded.get(job.entity_id);

    if (!product) continue;

    const { text, contentHash } = buildEmbeddableText(product);
    const current = await currentHash(db, job.entity_id);

    // The hash-skip. An unchanged product is not re-embedded, which is what
    // makes reconciling a whole catalogue cheap enough to do on a schedule.
    if (current === contentHash) {
      await finish(db, job.id);
      outcome.skippedUnchanged += 1;
      continue;
    }

    pending.push({ job, text, hash: contentHash });
  }

  for (const batch of chunk(pending)) {
    try {
      const vectors = await embedder.embed(
        batch.map((entry) => entry.text),
        "search_document",
      );

      for (const [index, entry] of batch.entries()) {
        const vector = vectors[index];

        if (!vector)
          throw new Error("Provider returned no vector for an input.");

        await writeEmbedding(
          db,
          entry.job.entity_id,
          vector,
          entry.hash,
          embedder.model,
        );
        await finish(db, entry.job.id);
        outcome.embedded += 1;
      }
    } catch (error: unknown) {
      // The batch failed as a unit — a rate limit, a network fault — so every
      // job in it is retried as a unit.
      for (const entry of batch) {
        await fail(db, entry.job, error);
        outcome.failed += 1;
      }
    }
  }

  return outcome;
}

/** Product rows keyed by id, in the shape the text builder wants. */
async function loadProducts(
  db: TenantPrismaClient,
  ids: readonly string[],
): Promise<ReadonlyMap<string, EmbeddableProduct>> {
  if (ids.length === 0) return new Map();

  const rows = await db.product.findMany({
    where: { id: { in: [...ids] }, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      attributes: true,
      categoryId: true,
      variants: {
        where: { isActive: true },
        select: { sku: true },
      },
    },
  });

  const paths = await categoryPaths(
    db,
    rows.flatMap((row) => (row.categoryId ? [row.categoryId] : [])),
  );

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        status: row.status,
        attributes: row.attributes,
        categoryPath: row.categoryId ? (paths.get(row.categoryId) ?? []) : [],
        skus: row.variants.map((variant) => variant.sku),
      },
    ]),
  );
}

/**
 * Root-first category names for each id.
 *
 * One recursive query rather than a walk per product: a catalogue batch shares
 * categories, and fifty products in one category should not be fifty walks up
 * the same tree.
 */
async function categoryPaths(
  db: TenantPrismaClient,
  ids: readonly string[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (ids.length === 0) return new Map();

  const rows = await db.$queryRaw<{ leaf_id: string; path: string[] }[]>`
    WITH RECURSIVE "walk" AS (
      SELECT c."id" AS "leaf_id", c."id", c."parent_id", ARRAY[c."name"] AS "path"
      FROM "categories" c
      WHERE c."id" = ANY(${Prisma.join([...ids])}::uuid[])
      UNION ALL
      SELECT w."leaf_id", p."id", p."parent_id", p."name" || w."path"
      FROM "categories" p
      JOIN "walk" w ON w."parent_id" = p."id"
    )
    SELECT "leaf_id"::text, "path"
    FROM "walk"
    WHERE "parent_id" IS NULL
  `;

  return new Map(rows.map((row) => [row.leaf_id, row.path]));
}

async function currentHash(
  db: TenantPrismaClient,
  productId: string,
): Promise<string | null> {
  const rows = await db.$queryRaw<{ content_hash: string }[]>`
    SELECT "content_hash" FROM "product_embeddings" WHERE "product_id" = ${productId}::uuid
  `;

  return rows[0]?.content_hash ?? null;
}

async function writeEmbedding(
  db: TenantPrismaClient,
  productId: string,
  vector: readonly number[],
  contentHash: string,
  model: string,
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "product_embeddings" ("product_id", "embedding", "content_hash", "model", "embedded_at")
    VALUES (${productId}::uuid, ${toVectorLiteral(vector)}::vector, ${contentHash}, ${model}, NOW())
    ON CONFLICT ("product_id") DO UPDATE
    SET "embedding" = EXCLUDED."embedding",
        "content_hash" = EXCLUDED."content_hash",
        "model" = EXCLUDED."model",
        "embedded_at" = EXCLUDED."embedded_at"
  `;
}

async function removeEmbedding(
  db: TenantPrismaClient,
  productId: string,
): Promise<void> {
  await db.$executeRaw`
    DELETE FROM "product_embeddings" WHERE "product_id" = ${productId}::uuid
  `;
}

async function finish(db: TenantPrismaClient, jobId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "embedding_jobs"
    SET "status" = 'done', "error" = NULL, "locked_at" = NULL
    WHERE "id" = ${BigInt(jobId)}
  `;
}

/**
 * Returns a job for another attempt, or fails it for good.
 *
 * Exponential backoff on `run_after` rather than an immediate retry: the
 * failures worth retrying are rate limits and network faults, and hammering
 * either makes them last longer.
 */
async function fail(
  db: TenantPrismaClient,
  job: ClaimedJob,
  error: unknown,
): Promise<void> {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).slice(0, 1000);

  if (job.attempts >= MAX_ATTEMPTS) {
    await db.$executeRaw`
      UPDATE "embedding_jobs"
      SET "status" = 'failed', "error" = ${message}, "locked_at" = NULL
      WHERE "id" = ${BigInt(job.id)}
    `;
    return;
  }

  const delaySeconds = Math.min(2 ** job.attempts * 15, 900);

  await db.$executeRaw`
    UPDATE "embedding_jobs"
    SET "status" = 'pending',
        "error" = ${message},
        "locked_at" = NULL,
        "run_after" = NOW() + (${delaySeconds} * INTERVAL '1 second')
    WHERE "id" = ${BigInt(job.id)}
  `;
}
