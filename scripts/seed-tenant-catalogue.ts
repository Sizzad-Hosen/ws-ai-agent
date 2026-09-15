import "dotenv/config";

import { seedCatalogue } from "../prisma/seed/catalogue";

import { prisma } from "@/server/db/prisma";

/**
 * Writes the development catalogue into a named tenant's own database.
 *
 * `npm run db:seed` fills only `northwind`, the fixture it creates itself. A
 * tenant that arrived the real way — a registration an administrator approved —
 * gets an empty database, so its Products, Categories, Customers and Orders
 * screens have nothing to show and cannot be reviewed. This points the same
 * seeder at that tenant.
 *
 * Idempotent, because `seedCatalogue` is: categories and products converge on
 * their slug, variants on their SKU and orders on their order number. A second
 * run changes nothing.
 *
 * Development data. It refuses to run when NODE_ENV is production, because
 * groceries in a live tenant's catalogue are not a mistake anyone can undo from
 * the console.
 *
 * Run it with `npm run tenant:seed -- <slug> [<slug> …]`, or `--all` for every
 * active tenant whose database is ready.
 */

async function slugsToSeed(args: readonly string[]): Promise<string[]> {
  if (!args.includes("--all")) {
    return args.filter((arg) => !arg.startsWith("--"));
  }

  const tenants = await prisma.tenant.findMany({
    // A tenant whose database is still PENDING or FAILED has nothing to seed.
    where: { status: "ACTIVE", database: { status: "READY" } },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  return tenants.map((tenant) => tenant.slug);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a development catalogue in production.");
  }

  const slugs = await slugsToSeed(process.argv.slice(2));

  if (slugs.length === 0) {
    console.error(
      "Name at least one tenant slug, or pass --all.\n" +
        "  npm run tenant:seed -- northwind\n" +
        "  npm run tenant:seed -- --all",
    );
    process.exitCode = 1;
    return;
  }

  const failures: string[] = [];

  for (const slug of slugs) {
    const counts = await seedCatalogue(slug);

    // seedCatalogue warns and returns zeros when the tenant does not resolve,
    // so zero products is the one outcome that means the seed did not happen.
    if (counts.products === 0) {
      failures.push(slug);
      continue;
    }

    console.info(
      `  ✓ ${slug} — ${counts.categories} categories, ${counts.products} ` +
        `products, ${counts.customers} customers, ${counts.orders} orders`,
    );
  }

  console.info(
    `\n${slugs.length} tenant(s): ${slugs.length - failures.length} seeded, ` +
      `${failures.length} failed.`,
  );

  if (failures.length > 0) {
    console.error(`Not seeded: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
