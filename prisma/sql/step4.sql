
-- =============================================================================
-- Raw SQL appended by hand. Prisma cannot express any of the objects below.
-- Keep this block in step with docs/db/master-db.sql; `npm run db:diff`
-- compares the live database against that file and fails on any difference.
-- =============================================================================

-- ----------------------------------------------------------- partial indexes

-- One live subscription per tenant. A canceled or expired row does not block a
-- new one, so a plain unique index on tenant_id would be wrong.
CREATE UNIQUE INDEX "uq_one_live_subscription" ON "subscriptions" ("tenant_id")
    WHERE "status" IN ('trialing', 'active', 'past_due');

-- Makes webhook delivery idempotent. The column is nullable, so the index must
-- be partial or every unrouted event would collide on NULL.
CREATE UNIQUE INDEX "uq_webhook_event" ON "webhook_events" ("provider_event_id")
    WHERE "provider_event_id" IS NOT NULL;

-- The BO tenant list reads only rows that are not soft-deleted.
CREATE INDEX "ix_tenants_status_live" ON "tenants" ("status")
    WHERE "deleted_at" IS NULL;

CREATE INDEX "ix_tenant_users_tenant_live" ON "tenant_users" ("tenant_id")
    WHERE "deleted_at" IS NULL;

-- The retry queue reads only these two states.
CREATE INDEX "ix_webhook_events_retry" ON "webhook_events" ("status", "received_at" DESC)
    WHERE "status" IN ('unrouted', 'failed');

-- --------------------------------------------------------- CHECK constraints

ALTER TABLE "plans"
    ADD CONSTRAINT "ck_plans_monthly_price_non_negative" CHECK ("monthly_price" >= 0),
    ADD CONSTRAINT "ck_plans_annual_price_non_negative" CHECK ("annual_price" >= 0),
    ADD CONSTRAINT "ck_plans_max_whatsapp_numbers_non_negative" CHECK ("max_whatsapp_numbers" >= 0),
    ADD CONSTRAINT "ck_plans_max_ai_messages_non_negative" CHECK ("max_ai_messages" >= 0),
    ADD CONSTRAINT "ck_plans_max_products_non_negative" CHECK ("max_products" >= 0);

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "ck_subscriptions_period_order"
    CHECK ("current_period_end" > "current_period_start");

ALTER TABLE "tenant_ai_configurations"
    ADD CONSTRAINT "ck_tenant_ai_configurations_tokens_used_non_negative"
    CHECK ("tokens_used" >= 0);

ALTER TABLE "feature_flags"
    ADD CONSTRAINT "ck_feature_flags_rollout_percent_range"
    CHECK ("rollout_percent" BETWEEN 0 AND 100);

ALTER TABLE "subscription_usage"
    ADD CONSTRAINT "ck_subscription_usage_value_non_negative"
    CHECK ("usage_value" >= 0);
