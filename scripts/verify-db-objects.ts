/**
 * Asserts that every object from step 4 exists in the live database.
 *
 * `npm run db:diff` already compares the whole catalog against master-db.sql.
 * This script is narrower and names each object, so a failure says which
 * partial index or CHECK went missing instead of printing a whole diff.
 *
 * It reads pg_indexes and pg_constraint. It never assumes.
 */
import { Client } from "pg";
import "dotenv/config";

const INDEXES = [
  "uq_one_live_subscription",
  "uq_webhook_event",
  "ix_tenants_status_live",
  "ix_tenants_approval_created",
  "ix_tenant_users_tenant_live",
  "ix_whatsapp_accounts_tenant_id",
  "ix_webhook_events_retry",
  "ix_webhook_events_provider_event_id",
  "ix_tenant_databases_migration",
  "ix_admin_audit_logs_tenant_created",
] as const;

const CHECKS = [
  "ck_plans_monthly_price_non_negative",
  "ck_plans_annual_price_non_negative",
  "ck_plans_max_whatsapp_numbers_non_negative",
  "ck_plans_max_ai_messages_non_negative",
  "ck_plans_max_products_non_negative",
  "ck_subscriptions_period_order",
  "ck_tenant_ai_configurations_tokens_used_non_negative",
  "ck_feature_flags_rollout_percent_range",
  "ck_subscription_usage_value_non_negative",
] as const;

/** Every index above that must carry a WHERE clause. */
const MUST_BE_PARTIAL = new Set([
  "uq_one_live_subscription",
  "uq_webhook_event",
  "ix_tenants_status_live",
  "ix_tenant_users_tenant_live",
  "ix_webhook_events_retry",
]);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") throw new Error("DATABASE_URL is not set.");

  const client = new Client({ connectionString: url.replace(/\?.*$/, "") });
  await client.connect();

  const indexes = new Map<string, string>();
  for (const row of (
    await client.query<{ indexname: string; indexdef: string }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'",
    )
  ).rows) {
    indexes.set(row.indexname, row.indexdef);
  }

  const checks = new Set(
    (
      await client.query<{ conname: string }>(
        `SELECT c.conname FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = 'public' AND c.contype = 'c'`,
      )
    ).rows.map((r) => r.conname),
  );

  const cascades = (
    await client.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE confdeltype = 'c'",
    )
  ).rows;

  await client.end();

  const failures: string[] = [];

  for (const name of INDEXES) {
    const def = indexes.get(name);
    if (def === undefined) {
      failures.push(`missing index ${name}`);
      continue;
    }
    if (MUST_BE_PARTIAL.has(name) && !def.includes(" WHERE ")) {
      failures.push(`index ${name} exists but lost its WHERE clause`);
    }
  }

  for (const name of CHECKS) {
    if (!checks.has(name)) failures.push(`missing CHECK ${name}`);
  }

  for (const row of cascades) {
    failures.push(`ON DELETE CASCADE is forbidden, found on ${row.conname}`);
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(`  ${f}`);
    console.error(`\n${failures.length} problem(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `All step 4 objects present: ${String(INDEXES.length)} indexes ` +
      `(${String(MUST_BE_PARTIAL.size)} partial), ${String(CHECKS.length)} CHECK ` +
      `constraints, 0 delete cascades.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
