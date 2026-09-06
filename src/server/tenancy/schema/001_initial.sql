-- Tenant database schema, version 2026.09.2.
--
-- Source of truth: docs/db/SaaS Tenant DB — Business + Storefront + AI +
-- WhatsApp.png. Every table, column, type, length and nullability below is
-- transcribed from that ERD, the same discipline prisma/schema.prisma follows
-- for the master database.
--
-- This is the *tenant* side: one business's own staff, storefront, orders,
-- WhatsApp accounts and AI usage. Nothing here is shared between tenants —
-- that is the entire point of a database per tenant.
--
-- Three classes of decision the diagram does not express, marked inline:
--
--   [T-01] Enum members. Every enum column is drawn simply as `enum`. The
--          members below are conventional defaults and await confirmation,
--          exactly as D-03 records for the master schema.
--   [T-02] `timestamptz` in place of the ERD's `timestamp`. Tenants span
--          US-East-1, LatAm and +44; a naive timestamp records the wrong
--          instant. This changes storage, not the logical model.
--   [T-03] Explicit decimal precision. Postgres requires one for money.
--
-- provider_id and model_id on tenant_ai_configurations and ai_usage_logs carry
-- no foreign key: they reference ai_providers / ai_models, which live in the
-- master database. A cross-database FK is not a thing Postgres can express.
--
-- Applied once, by src/server/tenancy/provision-database.ts, when an approved
-- registration becomes a tenant. Every statement is guarded so re-running it
-- completes a partial provision rather than failing on its own leftovers.

-- ------------------------------------------------------------- enums [T-01]

DO $$
BEGIN
    CREATE TYPE user_status AS ENUM ('invited', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE customer_status AS ENUM ('active', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE cart_status AS ENUM ('open', 'converted', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending', 'confirmed', 'processing', 'shipped',
        'delivered', 'cancelled', 'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending', 'authorized', 'paid', 'failed', 'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE review_status AS ENUM ('pending', 'published', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE whatsapp_account_status AS ENUM (
        'connected', 'auth_required', 'disconnected'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE whatsapp_verification_status AS ENUM (
        'pending', 'verified', 'rejected'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE contact_status AS ENUM ('active', 'blocked', 'opted_out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE conversation_status AS ENUM (
        'open', 'pending', 'resolved', 'closed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE message_sender_type AS ENUM ('customer', 'agent', 'ai', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE message_type AS ENUM (
        'text', 'image', 'audio', 'video', 'document', 'location', 'template'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE message_status AS ENUM (
        'queued', 'sent', 'delivered', 'read', 'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE webhook_event_status AS ENUM ('received', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE ai_usage_status AS ENUM ('success', 'error', 'throttled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------- tenant staff and access

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          VARCHAR(120) NOT NULL,
    status        user_status NOT NULL DEFAULT 'invited',
    last_login_at TIMESTAMPTZ(3),
    created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(120) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------- customers and places

CREATE TABLE IF NOT EXISTS customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(190),
    name       VARCHAR(150) NOT NULL,
    phone      VARCHAR(30),
    status     customer_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);

CREATE TABLE IF NOT EXISTS addresses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    label          VARCHAR(50),
    recipient_name VARCHAR(150) NOT NULL,
    phone          VARCHAR(30) NOT NULL,
    address_line   TEXT NOT NULL,
    city           VARCHAR(100) NOT NULL,
    region         VARCHAR(100),
    postal_code    VARCHAR(30),
    is_default     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS addresses_customer_id_idx ON addresses (customer_id);

-- ---------------------------------------------------------------- catalogue

CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Self-referencing: a category tree. SET NULL rather than CASCADE so
    -- removing a parent promotes its children instead of deleting them.
    parent_id   UUID REFERENCES categories (id) ON DELETE SET NULL,
    name        VARCHAR(150) NOT NULL,
    slug        VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories (parent_id);

CREATE TABLE IF NOT EXISTS products (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id       UUID REFERENCES categories (id) ON DELETE SET NULL,
    name              VARCHAR(220) NOT NULL,
    slug              VARCHAR(220) NOT NULL UNIQUE,
    description       TEXT,
    status            product_status NOT NULL DEFAULT 'draft',
    base_price        DECIMAL(12, 2) NOT NULL,
    compare_at_price  DECIMAL(12, 2),
    attributes        JSONB,
    created_at        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);

CREATE TABLE IF NOT EXISTS product_variants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sku              VARCHAR(100) NOT NULL UNIQUE,
    price            DECIMAL(12, 2) NOT NULL,
    compare_at_price DECIMAL(12, 2),
    attributes       JSONB,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
    ON product_variants (product_id);

CREATE TABLE IF NOT EXISTS inventory (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Unique: one stock record per variant, as drawn.
    product_variant_id UUID NOT NULL UNIQUE
                       REFERENCES product_variants (id) ON DELETE CASCADE,
    quantity           INTEGER NOT NULL DEFAULT 0,
    reserved_quantity  INTEGER NOT NULL DEFAULT 0,
    reorder_level      INTEGER,
    updated_at         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------- carts and orders

CREATE TABLE IF NOT EXISTS carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable: a guest browsing on WhatsApp has no customer record yet.
    customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
    session_key VARCHAR(190) UNIQUE,
    status      cart_status NOT NULL DEFAULT 'open',
    created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS carts_customer_id_idx ON carts (customer_id);

CREATE TABLE IF NOT EXISTS cart_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id            UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL
                       REFERENCES product_variants (id) ON DELETE RESTRICT,
    quantity           INTEGER NOT NULL CHECK (quantity > 0),
    -- Frozen at add-to-cart so a price change mid-session cannot move the
    -- total under the customer.
    unit_price_snapshot DECIMAL(12, 2) NOT NULL,
    created_at         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items (cart_id);

CREATE TABLE IF NOT EXISTS orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID REFERENCES customers (id) ON DELETE SET NULL,
    shipping_address_id UUID REFERENCES addresses (id) ON DELETE SET NULL,
    order_number        VARCHAR(80) NOT NULL UNIQUE,
    status              order_status NOT NULL DEFAULT 'pending',
    subtotal            DECIMAL(12, 2) NOT NULL,
    discount            DECIMAL(12, 2) NOT NULL DEFAULT 0,
    shipping_fee        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax                 DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total               DECIMAL(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    -- Restrict: a variant with order history must not be deleted out from
    -- under the orders that cite it. The snapshots below keep the line
    -- readable even so.
    product_variant_id    UUID NOT NULL
                          REFERENCES product_variants (id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(220) NOT NULL,
    sku_snapshot          VARCHAR(100) NOT NULL,
    unit_price            DECIMAL(12, 2) NOT NULL,
    quantity              INTEGER NOT NULL CHECK (quantity > 0),
    total                 DECIMAL(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_variant_id_idx
    ON order_items (product_variant_id);

CREATE TABLE IF NOT EXISTS order_payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    provider           VARCHAR(80) NOT NULL,
    provider_reference VARCHAR(190),
    amount             DECIMAL(12, 2) NOT NULL,
    currency           VARCHAR(10) NOT NULL,
    status             payment_status NOT NULL DEFAULT 'pending',
    paid_at            TIMESTAMPTZ(3),
    created_at         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx
    ON order_payments (order_id);

CREATE TABLE IF NOT EXISTS reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    -- Nullable: a review may exist without a verified purchase behind it.
    order_item_id UUID REFERENCES order_items (id) ON DELETE SET NULL,
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    status        review_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON reviews (product_id);
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews (status);

-- ------------------------------------------------------ whatsapp messaging

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number_id        VARCHAR(150) NOT NULL UNIQUE,
    business_account_id    VARCHAR(150) NOT NULL,
    display_phone_number   VARCHAR(40) NOT NULL,
    -- A pointer into the secret manager, never the token itself (S-03).
    access_token_reference TEXT NOT NULL,
    status                 whatsapp_account_status NOT NULL DEFAULT 'disconnected',
    verification_status    whatsapp_verification_status NOT NULL DEFAULT 'pending',
    quality_rating         VARCHAR(30),
    last_webhook_at        TIMESTAMPTZ(3),
    created_at             TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id  UUID REFERENCES whatsapp_accounts (id) ON DELETE SET NULL,
    -- Nullable: someone can message before they are ever a customer.
    customer_id          UUID REFERENCES customers (id) ON DELETE SET NULL,
    customer_name        VARCHAR(150),
    phone_number         VARCHAR(40) NOT NULL,
    display_phone_number VARCHAR(40),
    status               contact_status NOT NULL DEFAULT 'active',
    created_at           TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS contacts_phone_number_idx ON contacts (phone_number);
CREATE INDEX IF NOT EXISTS contacts_customer_id_idx ON contacts (customer_id);

CREATE TABLE IF NOT EXISTS conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id       UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
    -- Nullable: unassigned until a human picks it up; the AI needs no row.
    assigned_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    status           conversation_status NOT NULL DEFAULT 'open',
    last_message_at  TIMESTAMPTZ(3),
    created_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS conversations_contact_id_idx
    ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS conversations_status_last_message_at_idx
    ON conversations (status, last_message_at);

CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL
                        REFERENCES conversations (id) ON DELETE CASCADE,
    direction           message_direction NOT NULL,
    sender_type         message_sender_type NOT NULL,
    content             TEXT,
    message_type        message_type NOT NULL DEFAULT 'text',
    provider_message_id VARCHAR(190),
    -- Self-referencing: a reply quotes an earlier message. SET NULL so
    -- deleting the quoted message does not delete the reply.
    reply_to_message_id UUID REFERENCES messages (id) ON DELETE SET NULL,
    status              message_status NOT NULL DEFAULT 'queued',
    created_at          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
    ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_provider_message_id_idx
    ON messages (provider_message_id);

CREATE TABLE IF NOT EXISTS webhook_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id UUID REFERENCES whatsapp_accounts (id) ON DELETE SET NULL,
    -- Unique: the provider retries, and a retry must not be processed twice.
    provider_event_id   VARCHAR(190) UNIQUE,
    event_type          VARCHAR(100) NOT NULL,
    payload             JSONB NOT NULL,
    processed_at        TIMESTAMPTZ(3),
    status              webhook_event_status NOT NULL DEFAULT 'received',
    created_at          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS webhook_events_status_created_at_idx
    ON webhook_events (status, created_at);

-- ------------------------------------------------------------ AI and store

-- provider_id / model_id reference the master database's ai_providers and
-- ai_models. No FK is possible across databases, so they are bare UUIDs.
CREATE TABLE IF NOT EXISTS tenant_ai_configurations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id      UUID NOT NULL,
    model_id         UUID NOT NULL,
    -- A pointer into the secret manager, never a key (S-03).
    secret_reference TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    prompt_reference VARCHAR(190),
    token_limit      BIGINT,
    created_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
    provider_id     UUID,
    model_id        UUID,
    request_type    VARCHAR(80) NOT NULL,
    input_tokens    BIGINT NOT NULL DEFAULT 0,
    output_tokens   BIGINT NOT NULL DEFAULT 0,
    total_tokens    BIGINT NOT NULL DEFAULT 0,
    estimated_cost  DECIMAL(12, 6),
    status          ai_usage_status NOT NULL DEFAULT 'success',
    created_at      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx
    ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_logs_conversation_id_idx
    ON ai_usage_logs (conversation_id);

CREATE TABLE IF NOT EXISTS store_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(120) NOT NULL UNIQUE,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Records which schema version this database is at, so the provisioner can
-- tell an empty database from a provisioned one without inspecting tables.
-- Not on the ERD: a provisioner with no version marker cannot be idempotent.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(40) PRIMARY KEY,
    applied_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES ('2026.09.2')
    ON CONFLICT (version) DO NOTHING;
