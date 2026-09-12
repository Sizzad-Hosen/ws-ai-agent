import "dotenv/config";

import {
  listCategories,
  listCustomers,
  listOrders,
  listProducts,
  listSettings,
  listUsers,
} from "@/features/tenant-workspace/list-service";
import {
  DEFAULT_PAGE_SIZE,
  parseListParams,
} from "@/features/tenant-workspace/pagination";
import { TENANT_NAVIGATION_ENTRIES } from "@/features/tenant-dashboard/nav-segments";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/**
 * Proves every tenant sidebar link has a page, and that each list query runs.
 *
 * Two failures this catches that the unit tests cannot. First, a sidebar entry
 * whose route was never created — which is what made six links 404. Second, a
 * Prisma select that is wrong against the real tenant schema; a `_count` on a
 * relation that does not exist type-checks against the generated client but
 * fails at the database.
 *
 * Run it with `npm run verify:tenant-pages` after `npm run db:seed`.
 */

const SLUG = "northwind";
const ROUTE_ROOT = "src/app/(tenant)/[tenant]/tenants_reg";

function assert(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

async function main(): Promise<void> {
  const { access } = await import("node:fs/promises");

  // ---- every sidebar link resolves to a page file ------------------------
  const missing: string[] = [];

  for (const item of TENANT_NAVIGATION_ENTRIES) {
    try {
      await access(`${ROUTE_ROOT}/${item.segment}/page.tsx`);
    } catch {
      missing.push(`${item.label} -> /${item.segment}`);
    }
  }

  assert(
    missing.length === 0,
    `Sidebar links with no page (these 404):\n  ${missing.join("\n  ")}`,
  );

  // ---- every list query runs against a real tenant database --------------
  const resolution = await resolveTenant(SLUG);

  if (!resolution.ok) {
    throw new Error(
      `Tenant "${SLUG}" did not resolve (${resolution.reason}). Run npm run db:seed first.`,
    );
  }

  const db = resolution.tenant.db;
  const params = parseListParams({});
  const searching = parseListParams({ search: "a" });

  const [users, customers, products, categories, orders, settings] =
    await Promise.all([
      listUsers(db, params),
      listCustomers(db, params),
      listProducts(db, params),
      listCategories(db, params),
      listOrders(db, params),
      listSettings(db),
    ]);

  for (const [name, page] of [
    ["users", users],
    ["customers", customers],
    ["products", products],
    ["categories", categories],
    ["orders", orders],
  ] as const) {
    assert(page.limit === DEFAULT_PAGE_SIZE, `${name}: page size respected`);
    assert(page.offset === 0, `${name}: first page`);
    assert(page.total >= page.items.length, `${name}: total covers the page`);
    assert(
      page.items.length <= DEFAULT_PAGE_SIZE,
      `${name}: page is not over-filled`,
    );
  }

  // The search branch is a different query shape, so it needs its own run.
  await Promise.all([
    listUsers(db, searching),
    listCustomers(db, searching),
    listProducts(db, searching),
    listCategories(db, searching),
    listOrders(db, searching),
  ]);

  console.info(
    `verify:tenant-pages passed — ${TENANT_NAVIGATION_ENTRIES.length} sidebar links, ` +
      `all with pages. Rows: ${users.total} users, ${customers.total} customers, ` +
      `${products.total} products, ${categories.total} categories, ` +
      `${orders.total} orders, ${settings.length} settings.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Tenant pools are cached in module scope; without this the process hangs.
    process.exit(process.exitCode ?? 0);
  });
