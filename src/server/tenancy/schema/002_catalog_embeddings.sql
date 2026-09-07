-- Catalogue embeddings, and the machinery that keeps them converged.
--
-- Hand-written, unlike 001_initial.sql. None of what follows can be expressed
-- in a Prisma schema: an extension, a vector column type, an HNSW index, and
-- triggers. The tables are deliberately absent from prisma/tenant/schema.prisma
-- for the same reason — Prisma has no `vector` type, the claim loop needs
-- `FOR UPDATE SKIP LOCKED` which is raw SQL regardless, and keeping them out
-- means 001 stays regenerable from the Prisma schema.
--
-- On tenant isolation: there is no tenant_id column here, and that is not an
-- omission. Every tenant has its own database (see resolve-tenant.ts), so a
-- tenant column would be a constant and a row-level policy would protect rows
-- from nobody. The isolation boundary is the connection; a query cannot reach
-- another tenant's catalogue because it is not connected to it.

CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------- the index

-- One row per product. The vector is of the product's *describable* self —
-- name, description, category path, attributes — and never of its price or
-- stock, which change constantly and are answered by tool calls against the
-- live row instead. See build-text.ts.
CREATE TABLE "product_embeddings" (
    "product_id" UUID NOT NULL,
    "embedding" vector(1024) NOT NULL,
    -- sha256 of the canonical text. A product whose hash is unchanged is not
    -- re-embedded, which is what makes an unconditional resync cheap.
    "content_hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "embedded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("product_id"),
    CONSTRAINT "product_embeddings_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Cosine, because the embeddings are normalised and cosine is what the
-- provider's similarity is defined in. HNSW rather than IVFFlat: it needs no
-- training pass, which matters when a shop's catalogue starts at zero rows and
-- grows one product at a time.
CREATE INDEX "product_embeddings_embedding_idx"
    ON "product_embeddings" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "product_embeddings_content_hash_idx"
    ON "product_embeddings" ("content_hash");

-- ------------------------------------------------------------- the queue

CREATE TYPE "embedding_entity" AS ENUM ('product', 'category');
CREATE TYPE "embedding_op" AS ENUM ('upsert', 'delete');
CREATE TYPE "embedding_job_status" AS ENUM ('pending', 'running', 'done', 'failed');

CREATE TABLE "embedding_jobs" (
    "id" BIGSERIAL NOT NULL,
    "entity" "embedding_entity" NOT NULL,
    "entity_id" UUID NOT NULL,
    "op" "embedding_op" NOT NULL,
    "status" "embedding_job_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- When a runner claimed it. A row locked_at long ago is a runner that died
    -- mid-job, and is reclaimable.
    "locked_at" TIMESTAMPTZ(3),
    -- Earliest time this may be retried; how backoff is expressed.
    "run_after" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_jobs_pkey" PRIMARY KEY ("id")
);

-- The claim loop's only access path: pending work, oldest first. Partial, so
-- the index stays the size of the backlog rather than the size of all history.
CREATE INDEX "embedding_jobs_pending_idx"
    ON "embedding_jobs" ("run_after", "id")
    WHERE "status" = 'pending';

CREATE INDEX "embedding_jobs_stuck_idx"
    ON "embedding_jobs" ("locked_at")
    WHERE "status" = 'running';

-- ------------------------------------------------------- enqueue on change

-- Triggers rather than application code, so no write path can bypass them:
-- a seed script, a psql session, a future import job and the dashboard all
-- enqueue identically, because none of them can write a product without this
-- running.

CREATE OR REPLACE FUNCTION "enqueue_product_embedding"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- The embedding row is cascade-deleted with the product; the job is
        -- what removes it from anything holding it outside this database.
        INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
        VALUES ('product', OLD."id", 'delete');
        RETURN OLD;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        -- Only when something describable actually changed. Price, compare-at
        -- price and stock moves must not enqueue: they are not in the embedded
        -- text, so re-embedding on them would spend money to write the same
        -- vector back. `status` is here because it decides whether the product
        -- is retrievable at all.
        IF (
            NEW."name" IS DISTINCT FROM OLD."name"
            OR NEW."slug" IS DISTINCT FROM OLD."slug"
            OR NEW."description" IS DISTINCT FROM OLD."description"
            OR NEW."attributes" IS DISTINCT FROM OLD."attributes"
            OR NEW."category_id" IS DISTINCT FROM OLD."category_id"
            OR NEW."status" IS DISTINCT FROM OLD."status"
        ) THEN
            INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
            VALUES ('product', NEW."id", 'upsert');
        END IF;

        RETURN NEW;
    END IF;

    INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
    VALUES ('product', NEW."id", 'upsert');

    RETURN NEW;
END;
$$;

CREATE TRIGGER "products_embedding_enqueue"
    AFTER INSERT OR UPDATE OR DELETE ON "products"
    FOR EACH ROW EXECUTE FUNCTION "enqueue_product_embedding"();

-- A category's name is part of every descendant product's embedded text, so
-- renaming or moving one invalidates a whole subtree. The recursive CTE walks
-- down the tree from the changed category and enqueues every product under it.
CREATE OR REPLACE FUNCTION "enqueue_category_subtree_embeddings"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed_id UUID;
BEGIN
    changed_id := COALESCE(NEW."id", OLD."id");

    IF (TG_OP = 'UPDATE'
        AND NEW."name" IS NOT DISTINCT FROM OLD."name"
        AND NEW."parent_id" IS NOT DISTINCT FROM OLD."parent_id"
        AND NEW."is_active" IS NOT DISTINCT FROM OLD."is_active") THEN
        -- A description or slug edit does not change any product's text.
        RETURN NEW;
    END IF;

    INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
    SELECT 'product', p."id", 'upsert'
    FROM "products" p
    WHERE p."category_id" IN (
        WITH RECURSIVE "subtree" AS (
            SELECT changed_id AS "id"
            UNION ALL
            SELECT c."id"
            FROM "categories" c
            JOIN "subtree" s ON c."parent_id" = s."id"
        )
        SELECT "id" FROM "subtree"
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Deletes fire BEFORE, so the products still point at the category and can be
-- found. `ON DELETE SET NULL` on products.category_id is what makes the
-- resulting re-embed correct: by the time the job runs, those products have no
-- category and their text says so.
CREATE TRIGGER "categories_embedding_enqueue_delete"
    BEFORE DELETE ON "categories"
    FOR EACH ROW EXECUTE FUNCTION "enqueue_category_subtree_embeddings"();

CREATE TRIGGER "categories_embedding_enqueue_update"
    AFTER UPDATE ON "categories"
    FOR EACH ROW EXECUTE FUNCTION "enqueue_category_subtree_embeddings"();
