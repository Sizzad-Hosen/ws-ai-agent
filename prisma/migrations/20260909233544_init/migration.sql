-- Required by every uuid primary key default below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('super_admin', 'admin', 'support', 'finance');

-- CreateEnum
CREATE TYPE "admin_status" AS ENUM ('invited', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "registration_status" AS ENUM ('submitted', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "registration_check_type" AS ENUM ('business_verification', 'payment_method_linked', 'whatsapp_api_approval');

-- CreateEnum
CREATE TYPE "registration_check_status" AS ENUM ('pending', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "tenant_approval_status" AS ENUM ('pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('provisioning', 'trial', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "tenant_database_tier" AS ENUM ('shared', 'dedicated', 'isolated');

-- CreateEnum
CREATE TYPE "tenant_database_status" AS ENUM ('pending', 'provisioning', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "tenant_database_migration_state" AS ENUM ('pending', 'running', 'applied', 'failed');

-- CreateEnum
CREATE TYPE "tenant_user_role" AS ENUM ('owner', 'admin', 'agent', 'viewer');

-- CreateEnum
CREATE TYPE "tenant_user_status" AS ENUM ('invited', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "whatsapp_account_status" AS ENUM ('pending', 'connected', 'disconnected', 'suspended');

-- CreateEnum
CREATE TYPE "whatsapp_template_status" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'disabled');

-- CreateEnum
CREATE TYPE "whatsapp_template_category" AS ENUM ('marketing', 'utility', 'authentication');

-- CreateEnum
CREATE TYPE "webhook_event_status" AS ENUM ('unrouted', 'routed', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "ai_provider_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ai_purpose" AS ENUM ('chat', 'embedding', 'vision', 'rerank');

-- CreateEnum
CREATE TYPE "blog_post_status" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "status" "admin_status" NOT NULL DEFAULT 'invited',
    "avatar_url" TEXT,
    "totp_secret_reference" TEXT,
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "impersonating_tenant_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "resource_type" VARCHAR(80),
    "resource_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "registration_code" VARCHAR(40) NOT NULL,
    "business_name" VARCHAR(180) NOT NULL,
    "owner_name" VARCHAR(120) NOT NULL,
    "owner_email" VARCHAR(190) NOT NULL,
    "owner_phone" VARCHAR(30) NOT NULL,
    "industry" VARCHAR(100),
    "region" VARCHAR(80),
    "requested_plan_id" UUID,
    "status" "registration_status" NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "rejection_reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "tenant_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_registration_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_registration_id" UUID NOT NULL,
    "check_type" "registration_check_type" NOT NULL,
    "status" "registration_check_status" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "evidence" JSONB,
    "checked_at" TIMESTAMPTZ(6),
    "checked_by" UUID,

    CONSTRAINT "tenant_registration_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_code" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "registration_id" UUID,
    "business_name" VARCHAR(180) NOT NULL,
    "industry" VARCHAR(100),
    "business_region" VARCHAR(80),
    "country_code" CHAR(2),
    "timezone" VARCHAR(64),
    "default_locale" VARCHAR(10),
    "currency" CHAR(3),
    "owner_tenant_user_id" UUID,
    "owner_name" VARCHAR(120) NOT NULL,
    "owner_email" VARCHAR(190) NOT NULL,
    "owner_phone" VARCHAR(30),
    "approval_status" "tenant_approval_status" NOT NULL DEFAULT 'pending_review',
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "status" "tenant_status" NOT NULL DEFAULT 'provisioning',
    "provisioning_error" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_databases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tier" "tenant_database_tier" NOT NULL DEFAULT 'shared',
    "host_reference" VARCHAR(200) NOT NULL,
    "port" INTEGER NOT NULL,
    "database_name" VARCHAR(150) NOT NULL,
    "schema_name" VARCHAR(63),
    "username_reference" VARCHAR(200) NOT NULL,
    "secret_reference" TEXT NOT NULL,
    "read_replica_host" VARCHAR(200),
    "region" VARCHAR(80),
    "schema_version" VARCHAR(40),
    "migration_state" "tenant_database_migration_state" NOT NULL DEFAULT 'pending',
    "status" "tenant_database_status" NOT NULL DEFAULT 'pending',
    "last_backup_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30),
    "avatar_url" TEXT,
    "role" "tenant_user_role" NOT NULL DEFAULT 'viewer',
    "locale" VARCHAR(10),
    "status" "tenant_user_status" NOT NULL DEFAULT 'invited',
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret_reference" TEXT,
    "invite_token_hash" TEXT,
    "invite_expires_at" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "monthly_price" DECIMAL(12,2),
    "annual_price" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "max_whatsapp_numbers" INTEGER NOT NULL DEFAULT 0,
    "max_ai_messages" INTEGER NOT NULL DEFAULT 0,
    "max_products" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{"version":1,"toggles":[],"highlights":[]}'::jsonb,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'trialing',
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'monthly',
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "limits_snapshot" JSONB NOT NULL,
    "trial_ends_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ(6),
    "provider" VARCHAR(30),
    "provider_reference" VARCHAR(190),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "metric" VARCHAR(80) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "usage_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "limit_value" DECIMAL(18,4),
    "exceeded_at" TIMESTAMPTZ(6),

    CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID,
    "invoice_number" VARCHAR(80) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "line_items" JSONB NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID,
    "provider" VARCHAR(60) NOT NULL,
    "provider_reference" VARCHAR(190),
    "trx_id" VARCHAR(100),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "idempotency_key" VARCHAR(128),
    "raw_payload" JSONB,
    "paid_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "phone_number_id" VARCHAR(150) NOT NULL,
    "waba_id" VARCHAR(150) NOT NULL,
    "display_phone_number" VARCHAR(40),
    "business_name" VARCHAR(180),
    "token_reference" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "webhook_verify_token" VARCHAR(190),
    "app_secret_reference" TEXT,
    "status" "whatsapp_account_status" NOT NULL DEFAULT 'pending',
    "quality_rating" VARCHAR(30),
    "messaging_limit_tier" VARCHAR(30),
    "provider" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "whatsapp_account_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "category" "whatsapp_template_category" NOT NULL,
    "status" "whatsapp_template_status" NOT NULL DEFAULT 'draft',
    "components" JSONB NOT NULL,
    "provider_template_id" VARCHAR(150),
    "rejection_reason" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "whatsapp_account_id" UUID,
    "phone_number_id" VARCHAR(150),
    "provider_event_id" VARCHAR(190),
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "status" "webhook_event_status" NOT NULL DEFAULT 'unrouted',
    "error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "base_url" VARCHAR(255),
    "status" "ai_provider_status" NOT NULL DEFAULT 'active',
    "provider_reference" VARCHAR(190),

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ai_provider_id" UUID NOT NULL,
    "model_name" VARCHAR(120) NOT NULL,
    "purpose" "ai_purpose" NOT NULL DEFAULT 'chat',
    "capabilities" JSONB,
    "context_window" INTEGER,
    "input_cost_per_mtok" DECIMAL(12,4),
    "output_cost_per_mtok" DECIMAL(12,4),
    "embedding_dimensions" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ai_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "purpose" "ai_purpose" NOT NULL DEFAULT 'chat',
    "secret_reference" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "global_token_limit" BIGINT,
    "tenant_allocation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_tenant_token_limit" BIGINT,
    "warning_threshold_percent" INTEGER,

    CONSTRAINT "platform_ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ai_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ai_configuration_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_limit" BIGINT,
    "tokens_used" BIGINT NOT NULL DEFAULT 0,
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "byo_key_reference" TEXT,

    CONSTRAINT "tenant_ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "tenant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "model_id" UUID NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cached_tokens" BIGINT NOT NULL DEFAULT 0,
    "estimated_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("tenant_id","day","model_id")
);

-- CreateTable
CREATE TABLE "message_delivery_daily" (
    "tenant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "whatsapp_account_id" UUID NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "template_sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "message_delivery_daily_pkey" PRIMARY KEY ("tenant_id","day","whatsapp_account_id")
);

-- CreateTable
CREATE TABLE "tenant_daily_stats" (
    "tenant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "new_customers" INTEGER NOT NULL DEFAULT 0,
    "ai_resolved" INTEGER NOT NULL DEFAULT 0,
    "human_handoffs" INTEGER NOT NULL DEFAULT 0,
    "orders_created" INTEGER NOT NULL DEFAULT 0,
    "orders_confirmed" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_daily_stats_pkey" PRIMARY KEY ("tenant_id","day")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "default_value" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percent" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_feature_overrides" (
    "tenant_id" UUID NOT NULL,
    "feature_flag_id" UUID NOT NULL,
    "value" BOOLEAN NOT NULL,
    "reason" TEXT,
    "set_by" UUID,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_feature_overrides_pkey" PRIMARY KEY ("tenant_id","feature_flag_id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "title" VARCHAR(250) NOT NULL,
    "excerpt" VARCHAR(500),
    "body" TEXT NOT NULL,
    "author_id" UUID,
    "tags" JSONB,
    "meta_description" VARCHAR(320),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" "blog_post_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_admin_users_email" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_admin_sessions_token_hash" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "ix_admin_audit_logs_tenant_created" ON "admin_audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ix_login_attempts_identifier_created" ON "login_attempts"("identifier", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_registrations_code" ON "tenant_registrations"("registration_code");

-- CreateIndex
CREATE INDEX "ix_tenant_registrations_status_submitted" ON "tenant_registrations"("status", "submitted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_registration_checks_type" ON "tenant_registration_checks"("tenant_registration_id", "check_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenants_tenant_code" ON "tenants"("tenant_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenants_slug" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenants_registration_id" ON "tenants"("registration_id");

-- CreateIndex
CREATE INDEX "ix_tenants_approval_created" ON "tenants"("approval_status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_databases_tenant_id" ON "tenant_databases"("tenant_id");

-- CreateIndex
CREATE INDEX "ix_tenant_databases_migration" ON "tenant_databases"("schema_version", "migration_state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_users_tenant_email" ON "tenant_users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_user_sessions_token_hash" ON "tenant_user_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_plans_code" ON "plans"("code");

-- CreateIndex
CREATE INDEX "ix_plans_active_sort" ON "plans"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "ix_subscriptions_tenant_status" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ix_subscriptions_current_period_end" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_invoice_number" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "ix_invoices_tenant_status" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payments_idempotency_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "ix_payments_invoice_id" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_whatsapp_accounts_phone_number_id" ON "whatsapp_accounts"("phone_number_id");

-- CreateIndex
CREATE INDEX "ix_whatsapp_accounts_tenant_id" ON "whatsapp_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "ix_whatsapp_templates_account" ON "whatsapp_templates"("whatsapp_account_id", "status");

-- CreateIndex
CREATE INDEX "ix_webhook_events_provider_event_id" ON "webhook_events"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_models_provider_name" ON "ai_models"("ai_provider_id", "model_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_feature_flags_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "ix_blog_posts_status_published" ON "blog_posts"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_blog_posts_slug_locale" ON "blog_posts"("slug", "locale");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_impersonating_tenant_id_fkey" FOREIGN KEY ("impersonating_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_registrations" ADD CONSTRAINT "tenant_registrations_requested_plan_id_fkey" FOREIGN KEY ("requested_plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_registrations" ADD CONSTRAINT "tenant_registrations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_registration_checks" ADD CONSTRAINT "tenant_registration_checks_tenant_registration_id_fkey" FOREIGN KEY ("tenant_registration_id") REFERENCES "tenant_registrations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_registration_checks" ADD CONSTRAINT "tenant_registration_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "tenant_registrations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_tenant_user_id_fkey" FOREIGN KEY ("owner_tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_databases" ADD CONSTRAINT "tenant_databases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_user_sessions" ADD CONSTRAINT "tenant_user_sessions_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_ai_provider_id_fkey" FOREIGN KEY ("ai_provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "platform_ai_configurations" ADD CONSTRAINT "platform_ai_configurations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "platform_ai_configurations" ADD CONSTRAINT "platform_ai_configurations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_ai_configurations" ADD CONSTRAINT "tenant_ai_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_ai_configurations" ADD CONSTRAINT "tenant_ai_configurations_ai_configuration_id_fkey" FOREIGN KEY ("ai_configuration_id") REFERENCES "platform_ai_configurations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_delivery_daily" ADD CONSTRAINT "message_delivery_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_delivery_daily" ADD CONSTRAINT "message_delivery_daily_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_daily_stats" ADD CONSTRAINT "tenant_daily_stats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_feature_flag_id_fkey" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

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
