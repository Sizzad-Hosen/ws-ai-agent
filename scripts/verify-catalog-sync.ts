import "dotenv/config";

import { createHash } from "node:crypto";
import { Client } from "pg";

import { env } from "@/config/env";
import { buildEmbeddableText } from "@/server/catalog-sync/build-text";
import {
  EMBEDDING_DIMENSIONS,
  type Embedder,
} from "@/server/catalog-sync/embed";
import {
  hasSemanticIndex,
  searchCatalogueSemantically,
  catalogueIndexHealth,
} from "@/server/catalog-sync/retrieval";
import { syncTenantCatalogue } from "@/server/catalog-sync/sync-service";
import { prisma } from "@/server/db/prisma";
import { provisionDatabaseForTenant } from "@/server/services/provision-tenant-database";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import {
  releaseTenantPrisma,
  type TenantPrismaClient,
} from "@/server/tenancy/tenant-prisma";

/**
 * The catalogue sync layer, against real provisioned tenant databases.
 *
 * Everything asserted here is behaviour of Postgres or of this layer's SQL —
 * triggers firing on the right column, a recursive fan-out, `SKIP LOCKED`
 * handing a row to one claimant, an ANN query that cannot see another
 * database. None of it can be demonstrated with mocks, and most of it cannot
 * be demonstrated with a single tenant.
 *
 * The embedder is a deterministic stand-in rather than the provider: this
 * verifies the plumbing, not the model, and a test that spends money on
 * embeddings is a test nobody runs. Same text always gives the same vector, so
 * the hash-skip and the ANN ordering are both checkable.
 *
 * Requires a Postgres with pgvector. Without it the embeddings migration is
 * skipped by design (see migrate-tenant-database.ts), and this says so and
 * stops rather than failing in a way that looks like a bug in the code.
 */

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

/**
 * A stand-in embedder.
 *
 * The vector is derived from the text's hash, so identical text embeds
 * identically and different text does not. It carries no semantics — this
 * proves the index is written, queried and scoped, not that it is any good at
 * Bangla.
 */
const fakeEmbedder: Embedder = {
  model: "verify-fake-embedder",
  async embed(texts) {
    return texts.map((text) => {
      const digest = createHash("sha256").update(text, "utf8").digest();
      const vector = Array.from(
        { length: EMBEDDING_DIMENSIONS },
        (_, index) =>
          // Spread the 32 digest bytes over 1024 dimensions, centred on zero.
          (digest[index % digest.length] - 128) / 128,
      );
      const norm = Math.sqrt(
        vector.reduce((total, value) => total + value * value, 0),
      );

      return norm === 0 ? vector : vector.map((value) => value / norm);
    });
  },
};

interface Fixture {
  readonly tenantId: string;
  readonly slug: string;
  readonly databaseName: string;
  readonly db: TenantPrismaClient;
}

async function pendingJobs(db: TenantPrismaClient): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS "count" FROM "embedding_jobs" WHERE "status" = 'pending'
  `;

  return Number(rows[0]?.count ?? 0);
}

async function clearJobs(db: TenantPrismaClient): Promise<void> {
  await db.$executeRaw`DELETE FROM "embedding_jobs"`;
}

async function main(): Promise<void> {
  const stamp = Date.now().toString(36);
  const shopA = await createTenant(`verify-sync-a-${stamp}`);
  const shopB = await createTenant(`verify-sync-b-${stamp}`);

  try {
    if (!(await hasSemanticIndex(shopA.db))) {
      console.log(
        "Skipped: this Postgres has no pgvector, so the embeddings migration " +
          "was not applied. Point DATABASE_URL at a Postgres with the vector " +
          "extension (for example pgvector/pgvector:pg18) and run this again.",
      );
      return;
    }

    // ---- the trigger fires on a write, not on application code ------------
    const category = await shopA.db.category.create({
      data: { name: "Groceries", slug: "groceries", isActive: true },
      select: { id: true },
    });
    const child = await shopA.db.category.create({
      data: {
        name: "Rice",
        slug: "rice",
        parentId: category.id,
        isActive: true,
      },
      select: { id: true },
    });

    const product = await shopA.db.product.create({
      data: {
        name: "Premium Basmati Rice",
        slug: "premium-basmati-rice",
        status: "ACTIVE",
        basePrice: "180.00",
        categoryId: child.id,
        variants: {
          create: {
            sku: "RICE-5KG",
            price: "180.00",
            isActive: true,
            inventory: { create: { quantity: 12 } },
          },
        },
      },
      select: { id: true },
    });

    check(
      (await pendingJobs(shopA.db)) >= 1,
      "Inserting a product did not enqueue an embedding job.",
    );

    // ---- a price change must not enqueue ---------------------------------
    await clearJobs(shopA.db);
    await shopA.db.product.update({
      where: { id: product.id },
      data: { basePrice: "195.00", compareAtPrice: "220.00" },
    });
    check(
      (await pendingJobs(shopA.db)) === 0,
      "A price change enqueued an embedding job; volatile data is not indexed.",
    );

    await shopA.db.productVariant.updateMany({
      where: { sku: "RICE-5KG" },
      data: { price: "195.00" },
    });
    await shopA.db.inventory.updateMany({ data: { quantity: 3 } });
    check(
      (await pendingJobs(shopA.db)) === 0,
      "A stock change enqueued an embedding job.",
    );

    // ---- a describable change must enqueue -------------------------------
    await shopA.db.product.update({
      where: { id: product.id },
      data: { description: "Aged long-grain rice." },
    });
    check(
      (await pendingJobs(shopA.db)) === 1,
      "A description change did not enqueue an embedding job.",
    );

    // ---- category rename fans out to descendants -------------------------
    await clearJobs(shopA.db);
    await shopA.db.category.update({
      where: { id: category.id },
      data: { name: "Food & Groceries" },
    });
    check(
      (await pendingJobs(shopA.db)) === 1,
      "Renaming a parent category did not fan out to its descendants' products.",
    );

    // ---- the runner embeds, then skips what has not changed --------------
    const first = await syncTenantCatalogue(shopA.db, fakeEmbedder);
    check(
      first.embedded === 1,
      `First pass embedded ${first.embedded} products, not 1.`,
    );
    check(
      (await pendingJobs(shopA.db)) === 0,
      "The runner left pending jobs behind.",
    );

    const stored = await shopA.db.$queryRaw<{ content_hash: string }[]>`
      SELECT "content_hash" FROM "product_embeddings" WHERE "product_id" = ${product.id}::uuid
    `;
    check(stored.length === 1, "No embedding row was written.");

    const expected = buildEmbeddableText({
      id: product.id,
      name: "Premium Basmati Rice",
      slug: "premium-basmati-rice",
      description: "Aged long-grain rice.",
      status: "ACTIVE",
      attributes: null,
      categoryPath: ["Food & Groceries", "Rice"],
      skus: ["RICE-5KG"],
    });
    check(
      stored[0]?.content_hash === expected.contentHash,
      "The stored hash is not the hash of the canonical text.",
    );

    // Queue the same product again: unchanged, so no embedding call.
    await shopA.db.$executeRaw`
      INSERT INTO "embedding_jobs" ("entity", "entity_id", "op")
      VALUES ('product', ${product.id}::uuid, 'upsert')
    `;
    const second = await syncTenantCatalogue(shopA.db, fakeEmbedder);
    check(
      second.embedded === 0 && second.skippedUnchanged === 1,
      `An unchanged product was re-embedded (embedded ${second.embedded}).`,
    );

    // ---- retrieval returns the live row ----------------------------------
    const found = await searchCatalogueSemantically(shopA.db, expected.text, {
      embedder: fakeEmbedder,
      minimumScore: 0.5,
    });
    check(found.length === 1, `Semantic search returned ${found.length} rows.`);
    check(
      found[0]?.productName === "Premium Basmati Rice",
      "Semantic search returned the wrong product.",
    );
    // The price changed after the embedding was written; retrieval reads the
    // live row, so it must report the new one.
    check(
      found[0]?.price === "195.00",
      `Retrieval reported a stale price of ${found[0]?.price}.`,
    );
    check(
      found[0]?.available === 3,
      `Retrieval reported stale stock of ${found[0]?.available}.`,
    );

    // ---- one shop's index cannot answer for another ----------------------
    const across = await searchCatalogueSemantically(shopB.db, expected.text, {
      embedder: fakeEmbedder,
      minimumScore: 0,
    });
    check(
      across.length === 0,
      `Shop B's retrieval returned ${across.length} of Shop A's rows.`,
    );
    check(
      (await catalogueIndexHealth(shopB.db)).indexed === 0,
      "Shop B's index is not empty.",
    );

    // ---- deactivating a product takes it out of the index ----------------
    await shopA.db.product.update({
      where: { id: product.id },
      data: { status: "ARCHIVED" },
    });
    check(
      (await pendingJobs(shopA.db)) === 1,
      "Archiving a product did not enqueue anything.",
    );

    const third = await syncTenantCatalogue(shopA.db, fakeEmbedder);
    check(
      third.removed === 1,
      `Archiving removed ${third.removed} embeddings, not 1.`,
    );
    check(
      (await catalogueIndexHealth(shopA.db)).indexed === 0,
      "An archived product is still in the index.",
    );

    // ---- deleting the product cascades the embedding row ------------------
    await shopA.db.product.update({
      where: { id: product.id },
      data: { status: "ACTIVE" },
    });
    await syncTenantCatalogue(shopA.db, fakeEmbedder);
    check(
      (await catalogueIndexHealth(shopA.db)).indexed === 1,
      "Reactivating did not put the product back in the index.",
    );

    await shopA.db.product.delete({ where: { id: product.id } });
    check(
      (await catalogueIndexHealth(shopA.db)).indexed === 0,
      "Deleting a product left its embedding behind.",
    );

    // ---- concurrent runners do not do the same work twice ----------------
    await clearJobs(shopA.db);
    const many = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        shopA.db.product.create({
          data: {
            name: `Concurrent ${index}`,
            slug: `concurrent-${index}`,
            status: "ACTIVE",
            basePrice: "10.00",
            variants: {
              create: {
                sku: `CONC-${index}`,
                price: "10.00",
                isActive: true,
              },
            },
          },
          select: { id: true },
        }),
      ),
    );

    const [left, right] = await Promise.all([
      syncTenantCatalogue(shopA.db, fakeEmbedder, { batchSize: 3 }),
      syncTenantCatalogue(shopA.db, fakeEmbedder, { batchSize: 3 }),
    ]);

    check(
      left.embedded + right.embedded === many.length,
      `Two concurrent runners embedded ${left.embedded + right.embedded} of ${many.length} products.`,
    );
    check(
      (await catalogueIndexHealth(shopA.db)).indexed === many.length,
      "Concurrent runners did not converge the index.",
    );
    check(
      (await pendingJobs(shopA.db)) === 0,
      "Concurrent runners left work behind.",
    );

    console.log(
      `Catalogue sync verified across ${shopA.slug} and ${shopB.slug}: triggers enqueued on ` +
        `insert and on describable edits and stayed silent on price and stock changes; a parent ` +
        `category rename fanned out to its descendants; the runner embedded once and skipped the ` +
        `unchanged repeat; retrieval returned the live price and stock rather than the indexed ` +
        `snapshot; archiving and deleting removed the row; two concurrent runners split ${many.length} ` +
        `products without overlap; and Shop B's index answered nothing about Shop A. Cleaned up.`,
    );
  } finally {
    await destroy(shopA);
    await destroy(shopB);
  }
}

async function createTenant(slug: string): Promise<Fixture> {
  const databaseName = `sp_tenant_${slug.replace(/-/g, "_")}`;

  const tenant = await prisma.tenant.create({
    data: {
      tenantCode: `TEN-VERIFY-${slug.slice(-12)}`,
      businessName: `Verify ${slug}`,
      ownerName: "Verify Owner",
      ownerEmail: `${slug}@example.invalid`,
      ownerPhone: "+1 555 000 0000",
      industry: "Testing",
      region: "US-East-1",
      subdomain: slug,
      approvalStatus: "ACTIVE",
      database: {
        create: {
          databaseName,
          hostReference: "pending",
          port: 5432,
          usernameReference: "pending",
          secretReference: "pending",
          status: "PENDING",
          schemaVersion: "0",
          region: "US-East-1",
        },
      },
    },
    select: { id: true },
  });

  const provisioned = await provisionDatabaseForTenant(tenant.id);

  if (!provisioned.ok) {
    throw new Error(`Could not provision ${slug}: ${provisioned.reason}`);
  }

  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    throw new Error(`Could not resolve ${slug}: ${resolution.reason}`);
  }

  return {
    tenantId: tenant.id,
    slug,
    databaseName,
    db: resolution.tenant.db,
  };
}

async function destroy(fixture: Fixture): Promise<void> {
  await releaseTenantPrisma(fixture.tenantId);
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });

  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [fixture.databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${fixture.databaseName}"`);
  } finally {
    await admin.end().catch(() => undefined);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
