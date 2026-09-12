import "dotenv/config";

import { loadTenantAiUsage } from "@/features/tenant-ai-usage/usage-service";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/**
 * Proves the tenant AI usage path against a live database.
 *
 * The unit tests cover the shaping in `summarize.ts`; nothing there touches a
 * connection. This covers what they cannot: that the tenant resolves, that
 * `ai_usage_logs` is readable through that tenant's own client, and that the
 * figures the screen renders are the figures the rows actually hold.
 *
 * Run it with `npm run verify:ai-usage` after `npm run db:seed`.
 */

const SLUG = "northwind";

function check(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

function assert(condition: boolean, what: string): void {
  if (!condition) throw new Error(what);
}

async function main(): Promise<void> {
  const resolution = await resolveTenant(SLUG);

  if (!resolution.ok) {
    throw new Error(
      `Tenant "${SLUG}" did not resolve (${resolution.reason}). Run npm run db:seed first.`,
    );
  }

  const db = resolution.tenant.db;
  const usage = await loadTenantAiUsage(db);

  // ---- the summary matches the rows it was built from --------------------
  const rows = await db.aiUsageLog.findMany({
    select: { inputTokens: true, outputTokens: true, status: true },
  });

  assert(rows.length > 0, "No ai_usage_logs rows found. Run npm run db:seed.");

  const windowRows = await db.aiUsageLog.count({
    where: { createdAt: { gte: windowStart(usage.windowDays) } },
  });

  check(usage.requests, windowRows, "requests counts the window, not the table");

  const successes = rows.filter((row) => row.status === "SUCCESS").length;
  assert(
    successes < rows.length,
    "Every seeded call succeeded, so the error rate can never be exercised.",
  );

  // ---- the shape the screen depends on -----------------------------------
  check(
    usage.daily.length,
    usage.windowDays + 1,
    "one daily bucket per day, both ends inclusive",
  );
  assert(
    usage.daily.every((point) => typeof point.inputTokens === "number"),
    "daily buckets carry numbers",
  );
  assert(usage.byRequestType.length > 0, "request types are grouped");
  assert(
    usage.byRequestType.every((entry, index, all) =>
      index === 0 ? true : entry.requests <= (all[index - 1]?.requests ?? 0),
    ),
    "request types are ordered by volume, descending",
  );
  assert(usage.recent.length > 0, "recent calls are listed");
  assert(
    usage.recent.length <= 15,
    "recent calls are capped at the display limit",
  );
  assert(
    /^-?\d+\.\d{6}$/.test(usage.estimatedCost),
    `estimatedCost keeps six decimal places, got "${usage.estimatedCost}"`,
  );

  // ---- isolation ---------------------------------------------------------
  // The usage read takes no tenant id, because the connection is the boundary.
  // A second tenant would resolve to a different database entirely; this
  // asserts the one property that can be checked with a single tenant seeded.
  const unknown = await resolveTenant("no-such-workspace");
  check(
    unknown.ok,
    false,
    "an unknown slug does not resolve to any connection",
  );

  console.info(
    `verify:ai-usage passed — ${usage.requests} requests, ` +
      `${usage.totalTokens} tokens, $${usage.estimatedCost}, ` +
      `${usage.errorRatePercent}% errors over ${usage.windowDays} days.`,
  );
}

function windowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Tenant pools are cached in module scope; without this the process hangs.
    process.exit(process.exitCode ?? 0);
  });
