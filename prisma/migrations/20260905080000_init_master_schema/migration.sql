-- Master database baseline.
--
-- Transcribed from docs/db/SaaS Master DB — BO + Public Site.png (18 tables:
-- back-office identity/RBAC, tenants and registration, commercial, AI
-- configuration, and the public site).
--
-- Deviations from the diagram, both storage-level and documented in
-- prisma/schema.prisma: timestamptz instead of naive timestamp [D-07], and
-- explicit decimal(12,2) precision for money [D-08].
--
-- This replaces the previous baseline (20260902173259_init_master_schema),
-- which described a different, superseded schema.

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE');

-- CreateEnum
CREATE TYPE "admin_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "tenant_approval_status" AS ENUM ('PENDING_REVIEW', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "registration_status" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "registration_check_type" AS ENUM ('BUSINESS_VERIFICATION', 'PAYMENT_METHOD_LINKED', 'WHATSAPP_API_APPROVAL');

-- CreateEnum
CREATE TYPE "registration_check_status" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "tenant_database_status" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "ai_provider_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public_page_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "admin_role" NOT NULL,
    "status" "admin_status" NOT NULL DEFAULT 'INVITED',
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "tenant_registrations" (
    "id" UUID NOT NULL,
    "registration_code" VARCHAR(40) NOT NULL,
    "business_name" VARCHAR(180) NOT NULL,
    "owner_name" VARCHAR(120) NOT NULL,
    "owner_email" VARCHAR(190) NOT NULL,
    "owner_phone" VARCHAR(30) NOT NULL,
    "industry" VARCHAR(100) NOT NULL,
    "region" VARCHAR(80) NOT NULL,
    "requested_plan_id" UUID,
    "status" "registration_status" NOT NULL DEFAULT 'PENDING_REVIEW',

    CONSTRAINT "tenant_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_registration_checks" (
    "id" UUID NOT NULL,
    "tenant_registration_id" UUID NOT NULL,
    "check_type" "registration_check_type" NOT NULL,
    "status" "registration_check_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "checked_at" TIMESTAMPTZ(3),
    "checked_by" UUID,

    CONSTRAINT "tenant_registration_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "tenant_code" VARCHAR(40) NOT NULL,
    "business_name" VARCHAR(180) NOT NULL,
    "owner_name" VARCHAR(120) NOT NULL,
    "owner_email" VARCHAR(190) NOT NULL,
    "owner_phone" VARCHAR(30) NOT NULL,
    "industry" VARCHAR(100),
    "region" VARCHAR(80),
    "approval_status" "tenant_approval_status" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_databases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "database_name" VARCHAR(150) NOT NULL,
    "host_reference" VARCHAR(200) NOT NULL,
    "port" INTEGER NOT NULL,
    "username_reference" VARCHAR(200) NOT NULL,
    "secret_reference" TEXT NOT NULL,
    "status" "tenant_database_status" NOT NULL DEFAULT 'PENDING',
    "schema_version" VARCHAR(40) NOT NULL,
    "region" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "monthly_price" DECIMAL(12,2),
    "annual_price" DECIMAL(12,2),
    "currency" VARCHAR(10) NOT NULL,
    "features" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_cycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "invoice_number" VARCHAR(80) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "due_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "ai_provider_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_name" VARCHAR(120) NOT NULL,
    "capabilities" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ai_configurations" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "secret_reference" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "global_token_limit" BIGINT,
    "default_tenant_token_limit" BIGINT,
    "warning_threshold_percent" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_ai_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public_page_status" NOT NULL DEFAULT 'DRAFT',
    "seo_metadata" JSONB,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_faqs" (
    "id" UUID NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_site_settings" (
    "id" UUID NOT NULL,
    "site_key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "admin_role_permissions_permission_id_idx" ON "admin_role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_registrations_registration_code_key" ON "tenant_registrations"("registration_code");

-- CreateIndex
CREATE INDEX "tenant_registrations_status_idx" ON "tenant_registrations"("status");

-- CreateIndex
CREATE INDEX "tenant_registrations_requested_plan_id_idx" ON "tenant_registrations"("requested_plan_id");

-- CreateIndex
CREATE INDEX "tenant_registration_checks_tenant_registration_id_idx" ON "tenant_registration_checks"("tenant_registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_registration_checks_tenant_registration_id_check_typ_key" ON "tenant_registration_checks"("tenant_registration_id", "check_type");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tenant_code_key" ON "tenants"("tenant_code");

-- CreateIndex
CREATE INDEX "tenants_approval_status_idx" ON "tenants"("approval_status");

-- CreateIndex
CREATE INDEX "tenants_business_name_idx" ON "tenants"("business_name");

-- CreateIndex
CREATE INDEX "tenants_owner_email_idx" ON "tenants"("owner_email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_databases_tenant_id_key" ON "tenant_databases"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_databases_status_idx" ON "tenant_databases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_is_active_sort_order_idx" ON "plans"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_at_idx" ON "invoices"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_name_key" ON "ai_providers"("name");

-- CreateIndex
CREATE INDEX "ai_models_provider_id_is_active_idx" ON "ai_models"("provider_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_id_model_name_key" ON "ai_models"("provider_id", "model_name");

-- CreateIndex
CREATE INDEX "platform_ai_configurations_provider_id_idx" ON "platform_ai_configurations"("provider_id");

-- CreateIndex
CREATE INDEX "platform_ai_configurations_model_id_idx" ON "platform_ai_configurations"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_pages_slug_key" ON "public_pages"("slug");

-- CreateIndex
CREATE INDEX "public_pages_status_published_at_idx" ON "public_pages"("status", "published_at");

-- CreateIndex
CREATE INDEX "public_faqs_is_active_sort_order_idx" ON "public_faqs"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "public_site_settings_site_key_key" ON "public_site_settings"("site_key");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_registrations" ADD CONSTRAINT "tenant_registrations_requested_plan_id_fkey" FOREIGN KEY ("requested_plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_registration_checks" ADD CONSTRAINT "tenant_registration_checks_tenant_registration_id_fkey" FOREIGN KEY ("tenant_registration_id") REFERENCES "tenant_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_databases" ADD CONSTRAINT "tenant_databases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ai_configurations" ADD CONSTRAINT "platform_ai_configurations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ai_configurations" ADD CONSTRAINT "platform_ai_configurations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

