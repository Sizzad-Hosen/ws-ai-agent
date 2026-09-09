-- =============================================================================
-- Ordivex master database - MVP table set
-- =============================================================================
-- Source of truth for the master (control-plane) database.
--
-- Derived from docs/db/"Ordivex Master DB Design.png". That diagram draws 31
-- tables. This file keeps 28 of them and adds login_attempts, for 29 in total.
--
-- Removed from the diagram (not in MVP): permissions, role_permissions,
-- tenant_user_roles.
--
-- leads is in neither the diagram nor this file. It was cut from the MVP.
--
-- login_attempts is in neither the diagram nor the MVP list. It is kept
-- because the admin sign-in rate limit depends on it.
--
-- Columns marked "INFERRED" are NOT readable in the diagram. Overlapping boxes
-- hide them. The column width and the neighbouring columns give the type. The
-- name is a proposal. Review every one of them.
--
-- Conventions:
--   * Every enum is a native Postgres type. Values are lowercase.
--   * Every timestamp is timestamptz(6).
--   * Money is numeric(12,2). Usage counters are numeric(18,4). Unit costs are
--     numeric(12,4). Daily revenue is numeric(14,2).
--   * No ON DELETE CASCADE. Tenant deletion is an explicit multi-step job.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------- enum types

CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support', 'finance');
CREATE TYPE admin_status AS ENUM ('invited', 'active', 'suspended');

CREATE TYPE registration_status AS ENUM ('submitted', 'in_review', 'approved', 'rejected');
CREATE TYPE registration_check_type AS ENUM ('business_verification', 'payment_method_linked', 'whatsapp_api_approval');
CREATE TYPE registration_check_status AS ENUM ('pending', 'passed', 'failed');

CREATE TYPE tenant_approval_status AS ENUM ('pending_review', 'approved', 'rejected');
CREATE TYPE tenant_status AS ENUM ('provisioning', 'trial', 'active', 'suspended', 'archived');

CREATE TYPE tenant_database_tier AS ENUM ('shared', 'dedicated', 'isolated');
CREATE TYPE tenant_database_status AS ENUM ('pending', 'provisioning', 'ready', 'failed');
CREATE TYPE tenant_database_migration_state AS ENUM ('pending', 'running', 'applied', 'failed');

CREATE TYPE tenant_user_role AS ENUM ('owner', 'admin', 'agent', 'viewer');
CREATE TYPE tenant_user_status AS ENUM ('invited', 'active', 'suspended');

CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TYPE whatsapp_account_status AS ENUM ('pending', 'connected', 'disconnected', 'suspended');
CREATE TYPE whatsapp_template_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'disabled');
CREATE TYPE whatsapp_template_category AS ENUM ('marketing', 'utility', 'authentication');
CREATE TYPE webhook_event_status AS ENUM ('unrouted', 'routed', 'processed', 'failed');

CREATE TYPE ai_provider_status AS ENUM ('active', 'inactive');
CREATE TYPE ai_purpose AS ENUM ('chat', 'embedding', 'vision', 'rerank');

CREATE TYPE blog_post_status AS ENUM ('draft', 'published', 'archived');

-- ------------------------------------------------- back office: identity (1-3)

CREATE TABLE admin_users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  varchar(120) NOT NULL,
    email                 varchar(190) NOT NULL,
    password_hash         text         NOT NULL,
    role                  admin_role   NOT NULL,
    status                admin_status NOT NULL DEFAULT 'invited',
    avatar_url            text,
    totp_secret_reference text,
    last_login_at         timestamptz(6),
    deleted_at            timestamptz(6),
    created_at            timestamptz(6) NOT NULL DEFAULT now(), -- INFERRED
    updated_at            timestamptz(6) NOT NULL DEFAULT now()  -- INFERRED
);

CREATE TABLE admin_sessions (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id           uuid NOT NULL REFERENCES admin_users (id) ON DELETE RESTRICT,
    token_hash              text NOT NULL,
    -- Set while an admin acts as a tenant. FK added after tenants exists.
    impersonating_tenant_id uuid,
    ip_address              varchar(45),
    user_agent              text,
    expires_at              timestamptz(6) NOT NULL,
    revoked_at              timestamptz(6)
);

CREATE TABLE admin_audit_logs (
    id            bigserial PRIMARY KEY,
    admin_user_id uuid NOT NULL REFERENCES admin_users (id) ON DELETE RESTRICT,
    -- Null for platform-wide actions that name no tenant.
    tenant_id     uuid,
    action        varchar(100) NOT NULL,
    -- Impersonation requires a reason. The domain layer enforces that, because
    -- other actions legitimately have none.
    reason        text,
    resource_type varchar(80),
    resource_id   varchar(100),
    old_values    jsonb,
    new_values    jsonb,
    ip_address    varchar(45),
    -- INFERRED. Not in the diagram, but step 4 indexes (tenant_id, created_at).
    created_at    timestamptz(6) NOT NULL DEFAULT now()
);

-- -------------------------------------------------------- registrations (4-5)

CREATE TABLE tenant_registrations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_code varchar(40)  NOT NULL,
    business_name     varchar(180) NOT NULL,
    owner_name        varchar(120) NOT NULL,
    owner_email       varchar(190) NOT NULL,
    owner_phone       varchar(30)  NOT NULL,
    industry          varchar(100),
    region            varchar(80),
    requested_plan_id uuid,
    status            registration_status NOT NULL DEFAULT 'submitted',
    submitted_at      timestamptz(6) NOT NULL DEFAULT now(),
    reviewed_at       timestamptz(6),
    reviewed_by       uuid REFERENCES admin_users (id) ON DELETE RESTRICT,
    rejection_reason  text,
    metadata          jsonb
);

CREATE TABLE tenant_registration_checks (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_registration_id uuid NOT NULL REFERENCES tenant_registrations (id) ON DELETE RESTRICT,
    check_type             registration_check_type   NOT NULL,
    status                 registration_check_status NOT NULL DEFAULT 'pending',
    notes                  text,
    evidence               jsonb,
    checked_at             timestamptz(6),
    checked_by             uuid REFERENCES admin_users (id) ON DELETE RESTRICT
);

-- -------------------------------------------------------------- tenants (6-7)

CREATE TABLE tenants (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code          varchar(40)  NOT NULL,
    slug                 varchar(63)  NOT NULL,
    registration_id      uuid REFERENCES tenant_registrations (id) ON DELETE RESTRICT,
    business_name        varchar(180) NOT NULL,
    industry             varchar(100),
    business_region      varchar(80),
    country_code         char(2),
    timezone             varchar(64),
    default_locale       varchar(10),
    currency             char(3),
    -- Circular FK to tenant_users. Nullable, and added by the ALTER below.
    owner_tenant_user_id uuid,
    owner_name           varchar(120) NOT NULL,
    owner_email          varchar(190) NOT NULL,
    owner_phone          varchar(30),
    approval_status      tenant_approval_status NOT NULL DEFAULT 'pending_review',
    approved_at          timestamptz(6),
    approved_by          uuid REFERENCES admin_users (id) ON DELETE RESTRICT,
    rejected_at          timestamptz(6),
    rejection_reason     text,
    status               tenant_status NOT NULL DEFAULT 'provisioning',
    provisioning_error   text,
    deleted_at           timestamptz(6),                        -- INFERRED
    created_at           timestamptz(6) NOT NULL DEFAULT now(), -- INFERRED
    updated_at           timestamptz(6) NOT NULL DEFAULT now()  -- INFERRED
);

CREATE TABLE tenant_databases (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    tier               tenant_database_tier NOT NULL DEFAULT 'shared',
    host_reference     varchar(200) NOT NULL,
    port               int          NOT NULL,
    database_name      varchar(150) NOT NULL,
    schema_name        varchar(63),
    username_reference varchar(200) NOT NULL,
    secret_reference   text         NOT NULL,
    read_replica_host  varchar(200),
    region             varchar(80),   -- INFERRED
    schema_version     varchar(40),   -- INFERRED
    -- INFERRED. Step 4 indexes (schema_version, migration_state).
    migration_state    tenant_database_migration_state NOT NULL DEFAULT 'pending',
    status             tenant_database_status NOT NULL DEFAULT 'pending',
    last_backup_at     timestamptz(6)
);

-- ------------------------------------------------------ tenant identity (8-9)

CREATE TABLE tenant_users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    email                 varchar(190) NOT NULL,
    -- Null until the invited user sets a password.
    password_hash         text,
    name                  varchar(120) NOT NULL,
    phone                 varchar(30),
    avatar_url            text,
    -- The diagram draws "roles varchar(20)". Renamed to role and made an enum,
    -- because the RBAC tables are out of MVP.
    role                  tenant_user_role   NOT NULL DEFAULT 'viewer',
    locale                varchar(10),
    status                tenant_user_status NOT NULL DEFAULT 'invited',
    is_owner              boolean NOT NULL DEFAULT false,
    totp_secret_reference text,
    -- The invitations table is out of MVP, so the invite lives on the row.
    invite_token_hash     text,
    invite_expires_at     timestamptz(6),
    email_verified_at     timestamptz(6),
    last_login_at         timestamptz(6),
    deleted_at            timestamptz(6)
);

CREATE TABLE tenant_user_sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_user_id uuid NOT NULL REFERENCES tenant_users (id) ON DELETE RESTRICT,
    token_hash     text NOT NULL,
    ip_address     varchar(45),
    user_agent     text,
    expires_at     timestamptz(6) NOT NULL,
    revoked_at     timestamptz(6)
);

-- The circular pair. tenants.owner_tenant_user_id is nullable, so a tenant row
-- can exist before its owner row does.
ALTER TABLE tenants
    ADD CONSTRAINT tenants_owner_tenant_user_id_fkey
    FOREIGN KEY (owner_tenant_user_id) REFERENCES tenant_users (id) ON DELETE RESTRICT;

ALTER TABLE admin_sessions
    ADD CONSTRAINT admin_sessions_impersonating_tenant_id_fkey
    FOREIGN KEY (impersonating_tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

ALTER TABLE admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

-- ---------------------------------------------------------- commercial (10-14)

CREATE TABLE plans (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(40)  NOT NULL,
    name                 varchar(100) NOT NULL,
    description          text,
    -- Null means the tier is negotiated ("Custom").
    monthly_price        numeric(12,2),
    annual_price         numeric(12,2),
    currency             char(3) NOT NULL DEFAULT 'BDT',
    max_whatsapp_numbers int NOT NULL DEFAULT 0,
    max_ai_messages      int NOT NULL DEFAULT 0,
    max_products         int NOT NULL DEFAULT 0,
    -- INFERRED. Marketing content for the pricing cards: toggles, highlights,
    -- accent colour and the "popular" badge. The pricing page renders it, and
    -- the plans box has hidden rows below max_products, so the column belongs
    -- to the design rather than to the application.
    features             jsonb NOT NULL DEFAULT '{"version":1,"toggles":[],"highlights":[]}'::jsonb,
    is_active            boolean NOT NULL DEFAULT true,          -- INFERRED
    sort_order           int NOT NULL DEFAULT 0,                 -- INFERRED
    created_at           timestamptz(6) NOT NULL DEFAULT now(),  -- INFERRED
    updated_at           timestamptz(6) NOT NULL DEFAULT now()   -- INFERRED
);

-- Deferred: tenant_registrations is created before plans.
ALTER TABLE tenant_registrations
    ADD CONSTRAINT tenant_registrations_requested_plan_id_fkey
    FOREIGN KEY (requested_plan_id) REFERENCES plans (id) ON DELETE RESTRICT;

CREATE TABLE subscriptions (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    plan_id              uuid NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
    status               subscription_status NOT NULL DEFAULT 'trialing',
    billing_cycle        billing_cycle       NOT NULL DEFAULT 'monthly',
    -- Price agreed at signup. A catalogue edit never reprices a subscriber.
    price_snapshot       numeric(12,2) NOT NULL,
    currency             char(3) NOT NULL,
    -- Limits copied at signup. A plan edit must never rewrite this.
    limits_snapshot      jsonb NOT NULL,
    trial_ends_at        timestamptz(6),
    started_at           timestamptz(6) NOT NULL,
    current_period_start timestamptz(6) NOT NULL,        -- INFERRED
    current_period_end   timestamptz(6) NOT NULL,        -- INFERRED
    cancel_at_period_end boolean NOT NULL DEFAULT false, -- INFERRED
    cancelled_at         timestamptz(6),                 -- INFERRED
    provider             varchar(30),                    -- INFERRED
    provider_reference   varchar(190)                    -- INFERRED
);

CREATE TABLE subscription_usage (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    subscription_id uuid NOT NULL REFERENCES subscriptions (id) ON DELETE RESTRICT,
    metric          varchar(80) NOT NULL,
    period_start    timestamptz(6) NOT NULL,
    period_end      timestamptz(6) NOT NULL,
    usage_value     numeric(18,4) NOT NULL DEFAULT 0,
    limit_value     numeric(18,4),
    exceeded_at     timestamptz(6)
);

CREATE TABLE invoices (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    subscription_id uuid REFERENCES subscriptions (id) ON DELETE RESTRICT,
    invoice_number  varchar(80) NOT NULL,
    status          invoice_status NOT NULL DEFAULT 'draft',
    subtotal        numeric(12,2) NOT NULL,
    tax             numeric(12,2) NOT NULL DEFAULT 0,
    total           numeric(12,2) NOT NULL,
    currency        char(3) NOT NULL,
    line_items      jsonb NOT NULL
);

CREATE TABLE payments (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    invoice_id         uuid REFERENCES invoices (id) ON DELETE RESTRICT,
    provider           varchar(60) NOT NULL,
    provider_reference varchar(190),
    trx_id             varchar(100),
    amount             numeric(12,2) NOT NULL,
    currency           char(3) NOT NULL,
    status             payment_status NOT NULL DEFAULT 'pending',
    idempotency_key    varchar(128),
    raw_payload        jsonb,
    paid_at            timestamptz(6)
);

-- ------------------------------------------------------------ whatsapp (15-17)

CREATE TABLE whatsapp_accounts (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    phone_number_id      varchar(150) NOT NULL,
    waba_id              varchar(150) NOT NULL,
    display_phone_number varchar(40),
    business_name        varchar(180),
    token_reference      text,
    token_expires_at     timestamptz(6),
    webhook_verify_token varchar(190),
    app_secret_reference text,
    status               whatsapp_account_status NOT NULL DEFAULT 'pending', -- INFERRED
    quality_rating       varchar(30),                                        -- INFERRED
    messaging_limit_tier varchar(30),                                        -- INFERRED
    provider             varchar(30),                                        -- INFERRED
    created_at           timestamptz(6) NOT NULL DEFAULT now(),              -- INFERRED
    updated_at           timestamptz(6) NOT NULL DEFAULT now()               -- INFERRED
);

CREATE TABLE whatsapp_templates (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    whatsapp_account_id  uuid NOT NULL REFERENCES whatsapp_accounts (id) ON DELETE RESTRICT,
    name                 varchar(100) NOT NULL,
    language             varchar(10)  NOT NULL,
    category             whatsapp_template_category NOT NULL,
    status               whatsapp_template_status   NOT NULL DEFAULT 'draft',
    components           jsonb NOT NULL,
    provider_template_id varchar(150),
    rejection_reason     text,
    updated_at           timestamptz(6) NOT NULL DEFAULT now()  -- INFERRED
);

CREATE TABLE webhook_events (
    id                  bigserial PRIMARY KEY,
    -- Both stay null until the event is routed to a tenant.
    tenant_id           uuid REFERENCES tenants (id) ON DELETE RESTRICT,
    whatsapp_account_id uuid REFERENCES whatsapp_accounts (id) ON DELETE RESTRICT,
    phone_number_id     varchar(150),
    provider_event_id   varchar(190),
    event_type          varchar(100) NOT NULL,
    payload             jsonb NOT NULL,
    signature_valid     boolean NOT NULL DEFAULT false,
    status              webhook_event_status NOT NULL DEFAULT 'unrouted',
    error               text,
    received_at         timestamptz(6) NOT NULL DEFAULT now(),
    processed_at        timestamptz(6)
);

-- ------------------------------------------------------------------ ai (18-21)

CREATE TABLE ai_providers (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name               varchar(80)  NOT NULL,
    base_url           varchar(255),
    status             ai_provider_status NOT NULL DEFAULT 'active',
    provider_reference varchar(190)
);

CREATE TABLE ai_models (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_provider_id       uuid NOT NULL REFERENCES ai_providers (id) ON DELETE RESTRICT,
    model_name           varchar(120) NOT NULL,
    purpose              ai_purpose NOT NULL DEFAULT 'chat',
    capabilities         jsonb,
    context_window       int,
    input_cost_per_mtok  numeric(12,4),
    output_cost_per_mtok numeric(12,4),
    embedding_dimensions int,
    is_active            boolean NOT NULL DEFAULT true
);

CREATE TABLE platform_ai_configurations (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id                uuid NOT NULL REFERENCES ai_providers (id) ON DELETE RESTRICT,
    model_id                   uuid NOT NULL REFERENCES ai_models (id) ON DELETE RESTRICT,
    purpose                    ai_purpose NOT NULL DEFAULT 'chat',
    secret_reference           text,
    is_active                  boolean NOT NULL DEFAULT true,
    is_default                 boolean NOT NULL DEFAULT false,
    global_token_limit         bigint,
    tenant_allocation_enabled  boolean NOT NULL DEFAULT false,
    default_tenant_token_limit bigint,
    warning_threshold_percent  int
);

CREATE TABLE tenant_ai_configurations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    ai_configuration_id uuid NOT NULL REFERENCES platform_ai_configurations (id) ON DELETE RESTRICT,
    is_active           boolean NOT NULL DEFAULT true,
    token_limit         bigint,
    tokens_used         bigint NOT NULL DEFAULT 0,
    period_start        timestamptz(6),
    period_end          timestamptz(6),
    byo_key_reference   text
);

-- -------------------------------------------------------- daily rollups (22-24)

CREATE TABLE ai_usage_daily (
    tenant_id      uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    day            date NOT NULL,
    model_id       uuid NOT NULL REFERENCES ai_models (id) ON DELETE RESTRICT,
    requests       int    NOT NULL DEFAULT 0,
    input_tokens   bigint NOT NULL DEFAULT 0,
    output_tokens  bigint NOT NULL DEFAULT 0,
    cached_tokens  bigint NOT NULL DEFAULT 0,
    estimated_cost numeric(12,4) NOT NULL DEFAULT 0,
    error_count    int NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, day, model_id)
);

CREATE TABLE message_delivery_daily (
    tenant_id           uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    day                 date NOT NULL,
    whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts (id) ON DELETE RESTRICT,
    sent          int NOT NULL DEFAULT 0,
    delivered     int NOT NULL DEFAULT 0,
    read_count    int NOT NULL DEFAULT 0,
    failed        int NOT NULL DEFAULT 0,
    template_sent int NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, day, whatsapp_account_id)
);

CREATE TABLE tenant_daily_stats (
    tenant_id        uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    day              date NOT NULL,
    conversations    int NOT NULL DEFAULT 0,
    new_customers    int NOT NULL DEFAULT 0,
    ai_resolved      int NOT NULL DEFAULT 0,
    human_handoffs   int NOT NULL DEFAULT 0,
    orders_created   int NOT NULL DEFAULT 0,
    orders_confirmed int NOT NULL DEFAULT 0,
    revenue          numeric(14,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, day)
);

-- -------------------------------------------------------- platform ops (25-28)

CREATE TABLE feature_flags (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key             varchar(80) NOT NULL,
    description     text,
    default_value   boolean NOT NULL DEFAULT false,
    rollout_percent int NOT NULL DEFAULT 0,
    is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE tenant_feature_overrides (
    tenant_id       uuid NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    feature_flag_id uuid NOT NULL REFERENCES feature_flags (id) ON DELETE RESTRICT,
    value           boolean NOT NULL,
    reason          text,
    set_by          uuid REFERENCES admin_users (id) ON DELETE RESTRICT,
    expires_at      timestamptz(6),
    PRIMARY KEY (tenant_id, feature_flag_id)
);

CREATE TABLE platform_settings (
    key         varchar(100) PRIMARY KEY,
    value       jsonb NOT NULL,
    description text,
    updated_by  uuid REFERENCES admin_users (id) ON DELETE RESTRICT,
    updated_at  timestamptz(6) NOT NULL DEFAULT now()
);

-- Not in the diagram and not in either MVP list. Kept because the admin
-- sign-in rate limit reads it. Removing it would delete a shipped security
-- control. Identifier is "email:<address>", "ip:<address>" or "register:<ip>".
CREATE TABLE login_attempts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier varchar(200) NOT NULL,
    created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE blog_posts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             varchar(200) NOT NULL,
    locale           varchar(10)  NOT NULL DEFAULT 'en',
    title            varchar(250) NOT NULL,
    excerpt          varchar(500),
    body             text NOT NULL,
    author_id        uuid REFERENCES admin_users (id) ON DELETE RESTRICT,
    tags             jsonb,
    meta_description varchar(320),
    view_count       int NOT NULL DEFAULT 0,
    status           blog_post_status NOT NULL DEFAULT 'draft',
    published_at     timestamptz(6),
    created_at       timestamptz(6) NOT NULL DEFAULT now()  -- INFERRED
);

-- =============================================================================
-- Unique constraints
-- =============================================================================

CREATE UNIQUE INDEX uq_admin_users_email ON admin_users (email);
CREATE UNIQUE INDEX uq_admin_sessions_token_hash ON admin_sessions (token_hash);
CREATE UNIQUE INDEX uq_tenant_registrations_code ON tenant_registrations (registration_code);
CREATE UNIQUE INDEX uq_tenant_registration_checks_type
    ON tenant_registration_checks (tenant_registration_id, check_type);
CREATE UNIQUE INDEX uq_tenants_tenant_code ON tenants (tenant_code);
CREATE UNIQUE INDEX uq_tenants_slug ON tenants (slug);
CREATE UNIQUE INDEX uq_tenants_registration_id ON tenants (registration_id);
CREATE UNIQUE INDEX uq_tenant_databases_tenant_id ON tenant_databases (tenant_id);
CREATE UNIQUE INDEX uq_tenant_users_tenant_email ON tenant_users (tenant_id, email);
CREATE UNIQUE INDEX uq_tenant_user_sessions_token_hash ON tenant_user_sessions (token_hash);
CREATE UNIQUE INDEX uq_plans_code ON plans (code);
CREATE UNIQUE INDEX uq_invoices_invoice_number ON invoices (invoice_number);
CREATE UNIQUE INDEX uq_payments_idempotency_key ON payments (idempotency_key);
CREATE UNIQUE INDEX uq_whatsapp_accounts_phone_number_id ON whatsapp_accounts (phone_number_id);
CREATE UNIQUE INDEX uq_feature_flags_key ON feature_flags (key);
CREATE UNIQUE INDEX uq_blog_posts_slug_locale ON blog_posts (slug, locale);
CREATE UNIQUE INDEX uq_ai_models_provider_name ON ai_models (ai_provider_id, model_name);

-- Partial unique indexes. Prisma cannot express these.
--
-- One live subscription per tenant. A cancelled or expired row does not block a
-- new one.
CREATE UNIQUE INDEX uq_one_live_subscription ON subscriptions (tenant_id)
    WHERE status IN ('trialing', 'active', 'past_due');

-- The provider event id makes webhook delivery idempotent, but it is nullable.
CREATE UNIQUE INDEX uq_webhook_event ON webhook_events (provider_event_id)
    WHERE provider_event_id IS NOT NULL;

-- =============================================================================
-- CHECK constraints
-- =============================================================================

ALTER TABLE plans
    ADD CONSTRAINT ck_plans_monthly_price_non_negative CHECK (monthly_price >= 0),
    ADD CONSTRAINT ck_plans_annual_price_non_negative CHECK (annual_price >= 0),
    ADD CONSTRAINT ck_plans_max_whatsapp_numbers_non_negative CHECK (max_whatsapp_numbers >= 0),
    ADD CONSTRAINT ck_plans_max_ai_messages_non_negative CHECK (max_ai_messages >= 0),
    ADD CONSTRAINT ck_plans_max_products_non_negative CHECK (max_products >= 0);

ALTER TABLE subscriptions
    ADD CONSTRAINT ck_subscriptions_period_order CHECK (current_period_end > current_period_start);

ALTER TABLE tenant_ai_configurations
    ADD CONSTRAINT ck_tenant_ai_configurations_tokens_used_non_negative CHECK (tokens_used >= 0);

ALTER TABLE feature_flags
    ADD CONSTRAINT ck_feature_flags_rollout_percent_range
    CHECK (rollout_percent BETWEEN 0 AND 100);

ALTER TABLE subscription_usage
    ADD CONSTRAINT ck_subscription_usage_value_non_negative CHECK (usage_value >= 0);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Only live tenants. The BO tenant list filters on this.
CREATE INDEX ix_tenants_status_live ON tenants (status) WHERE deleted_at IS NULL;
CREATE INDEX ix_tenants_approval_created ON tenants (approval_status, created_at DESC);
CREATE INDEX ix_tenant_users_tenant_live ON tenant_users (tenant_id) WHERE deleted_at IS NULL;

-- Hottest path. Every inbound webhook routes through this.
CREATE INDEX ix_whatsapp_accounts_tenant_id ON whatsapp_accounts (tenant_id);

-- The retry queue reads only these two states.
CREATE INDEX ix_webhook_events_retry ON webhook_events (status, received_at DESC)
    WHERE status IN ('unrouted', 'failed');
CREATE INDEX ix_webhook_events_provider_event_id ON webhook_events (provider_event_id);

CREATE INDEX ix_tenant_databases_migration ON tenant_databases (schema_version, migration_state);
CREATE INDEX ix_admin_audit_logs_tenant_created ON admin_audit_logs (tenant_id, created_at DESC);

CREATE INDEX ix_tenant_registrations_status_submitted
    ON tenant_registrations (status, submitted_at DESC);
CREATE INDEX ix_subscriptions_tenant_status ON subscriptions (tenant_id, status);
CREATE INDEX ix_subscriptions_current_period_end ON subscriptions (current_period_end);
CREATE INDEX ix_invoices_tenant_status ON invoices (tenant_id, status);
CREATE INDEX ix_payments_invoice_id ON payments (invoice_id);
CREATE INDEX ix_plans_active_sort ON plans (is_active, sort_order);
CREATE INDEX ix_whatsapp_templates_account ON whatsapp_templates (whatsapp_account_id, status);
CREATE INDEX ix_blog_posts_status_published ON blog_posts (status, published_at DESC);

-- Serves both the sliding-window count and the sweeper.
CREATE INDEX ix_login_attempts_identifier_created ON login_attempts (identifier, created_at);
