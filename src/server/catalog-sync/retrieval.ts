import "server-only";

import { toAmount } from "@/features/tenant-dashboard/money";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import { resolveEmbedder, toVectorLiteral, type Embedder } from "./embed";

/**
 * Semantic catalogue search.
 *
 * Tenant scoping is in the type signature, as the brief asked — but it is not
 * a `tenantId: string` argument, because this application does not have one to
 * pass. Each tenant has its own database, and this takes that database's client
 * (`TenantPrismaClient`, which only `resolveTenant` hands out). A caller cannot
 * forget to scope the query, and cannot scope it *wrongly*: there is no tenant
 * column to compare and no other tenant's rows in reach. An id-plus-filter
 * design can be bypassed by omitting the filter; this cannot be, because the
 * connection *is* the filter.
 *
 * Two more properties worth stating:
 *
 *  - **Only sellable rows come back.** The ANN search is joined to the live
 *    product and its variants and filtered to active before it returns, so the
 *    index having a stale row cannot surface a draft or archived product.
 *  - **Prices and stock are read live, never from the index.** The vector
 *    describes the product; what it costs and how many are left come from the
 *    row in the same query. That is why price and stock are excluded from the
 *    embedded text (see build-text.ts) and it is what keeps an answer current.
 */

export interface SemanticMatch {
  readonly productId: string;
  /** Cosine similarity, 1 being identical. */
  readonly score: number;
  readonly productName: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryName: string | null;
  /** The live figures, joined at query time. */
  readonly variantId: string;
  readonly sku: string;
  readonly price: string;
  readonly available: number | null;
}

export interface SemanticSearchOptions {
  readonly limit?: number;
  /**
   * Cosine similarity floor. Below this a "match" is noise, and answering a
   * shopper out of noise is worse than telling them nothing was found.
   */
  readonly minimumScore?: number;
  /** Injectable so a test can search without a provider account. */
  readonly embedder?: Embedder;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_MINIMUM_SCORE = 0.3;

interface MatchRow {
  readonly product_id: string;
  readonly score: number;
  readonly product_name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly category_name: string | null;
  readonly variant_id: string;
  readonly sku: string;
  readonly price: string;
  readonly quantity: number | null;
  readonly reserved: number | null;
}

/**
 * Whether this database can answer a vector search at all.
 *
 * A tenant provisioned on a server without pgvector has no embeddings table,
 * and the storefront should degrade to lexical search rather than fail. Cheap
 * enough to ask per query, and it is the difference between a shop that
 * answers and a shop that errors.
 */
export async function hasSemanticIndex(
  db: TenantPrismaClient,
): Promise<boolean> {
  const rows = await db.$queryRaw<{ present: boolean }[]>`
      SELECT to_regclass('public.product_embeddings') IS NOT NULL AS present
    `.catch(() => null);

  return rows?.[0]?.present === true;
}

/**
 * The catalogue, searched by meaning.
 *
 * Returns an empty list rather than throwing when there is no index or no
 * embedding provider: the caller's fallback is lexical search, and a shopper
 * should never see the difference as an error.
 */
export async function searchCatalogueSemantically(
  db: TenantPrismaClient,
  query: string,
  options: SemanticSearchOptions = {},
): Promise<readonly SemanticMatch[]> {
  const trimmed = query.trim();

  if (trimmed === "") return [];

  const embedder = options.embedder ?? resolveEmbedder();

  if (!embedder) return [];
  if (!(await hasSemanticIndex(db))) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const minimumScore = options.minimumScore ?? DEFAULT_MINIMUM_SCORE;

  let vector: readonly number[] | undefined;

  try {
    // A query is embedded as a query, not as a document: this model family
    // treats the two differently and mixing them costs recall.
    [vector] = await embedder.embed([trimmed], "search_query");
  } catch (error: unknown) {
    console.error("Catalogue query could not be embedded.", error);
    return [];
  }

  if (!vector) return [];

  const literal = toVectorLiteral(vector);

  // The ANN search is a subquery so the index is used before the joins, and
  // over-fetched so that filtering to sellable rows afterwards does not return
  // fewer results than asked for.
  const rows = await db.$queryRaw<MatchRow[]>`
    WITH "nearest" AS (
      SELECT "product_id", 1 - ("embedding" <=> ${literal}::vector) AS "score"
      FROM "product_embeddings"
      ORDER BY "embedding" <=> ${literal}::vector
      LIMIT ${limit * 4}
    )
    SELECT
      n."product_id"::text,
      n."score"::float8,
      p."name" AS "product_name",
      p."slug",
      p."description",
      c."name" AS "category_name",
      v."id"::text AS "variant_id",
      v."sku",
      v."price"::text,
      i."quantity",
      i."reserved_quantity" AS "reserved"
    FROM "nearest" n
    JOIN "products" p ON p."id" = n."product_id"
    LEFT JOIN "categories" c ON c."id" = p."category_id"
    JOIN "product_variants" v ON v."product_id" = p."id" AND v."is_active" = true
    LEFT JOIN "inventory" i ON i."product_variant_id" = v."id"
    WHERE p."status" = 'ACTIVE' AND n."score" >= ${minimumScore}
    ORDER BY n."score" DESC, v."sku" ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    productId: row.product_id,
    score: row.score,
    productName: row.product_name,
    slug: row.slug,
    description: row.description,
    categoryName: row.category_name,
    variantId: row.variant_id,
    sku: row.sku,
    price: toAmount(row.price),
    // Null means stock is not tracked, exactly as elsewhere: no inventory row
    // is a shop that does not count, not a shop that is empty.
    available:
      row.quantity === null
        ? null
        : Math.max(0, row.quantity - (row.reserved ?? 0)),
  }));
}

export interface IndexHealth {
  readonly indexed: number;
  readonly pending: number;
  readonly failed: number;
  readonly lastSyncedAt: string | null;
}

/** What the sync-status endpoint reports. Absent tables read as all zeroes. */
export async function catalogueIndexHealth(
  db: TenantPrismaClient,
): Promise<IndexHealth> {
  if (!(await hasSemanticIndex(db))) {
    return { indexed: 0, pending: 0, failed: 0, lastSyncedAt: null };
  }

  const rows = await db.$queryRaw<
    {
      indexed: bigint;
      pending: bigint;
      failed: bigint;
      last_synced_at: Date | null;
    }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM "product_embeddings") AS "indexed",
      (SELECT COUNT(*) FROM "embedding_jobs" WHERE "status" IN ('pending', 'running')) AS "pending",
      (SELECT COUNT(*) FROM "embedding_jobs" WHERE "status" = 'failed') AS "failed",
      (SELECT MAX("embedded_at") FROM "product_embeddings") AS "last_synced_at"
  `;

  const row = rows[0];

  return {
    indexed: Number(row?.indexed ?? 0),
    pending: Number(row?.pending ?? 0),
    failed: Number(row?.failed ?? 0),
    lastSyncedAt: row?.last_synced_at?.toISOString() ?? null,
  };
}
