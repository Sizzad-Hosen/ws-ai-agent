-- WhatsApp Cloud API as a Meta Tech Provider.
--
-- Written by hand rather than by `prisma migrate dev`: the migration history
-- cannot replay into a shadow database, because `20260909233544_init` is dated
-- after the five migrations that alter the tables it creates. That is a
-- pre-existing fault in the history and is not this migration's to fix.
--
-- Every table touched here is empty, which is what makes the enum recreation
-- and the NOT NULL `dedupe_hash` safe to apply in one step.

-- ---------------------------------------------------------------- enums

-- The connection state machine. `connected` and `suspended` are gone: a
-- boolean-shaped "connected" cannot say whether the token was exchanged, the
-- number registered, or the app actually subscribed to the WABA — and those
-- fail separately, so they have to be visible separately.
--
-- Recreated rather than extended: ALTER TYPE cannot remove a value, and
-- whatsapp_accounts is empty so nothing is rewritten.
ALTER TABLE "whatsapp_accounts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "whatsapp_account_status" RENAME TO "whatsapp_account_status_old";

CREATE TYPE "whatsapp_account_status" AS ENUM (
    'pending',
    'connecting',
    'token_exchanged',
    'registered',
    'subscribed',
    'verified',
    'live',
    'failed',
    'disconnected'
);

ALTER TABLE "whatsapp_accounts"
    ALTER COLUMN "status" TYPE "whatsapp_account_status"
    USING (
        CASE "status"::text
            WHEN 'connected' THEN 'live'
            WHEN 'suspended' THEN 'failed'
            ELSE "status"::text
        END
    )::"whatsapp_account_status";

ALTER TABLE "whatsapp_accounts"
    ALTER COLUMN "status" SET DEFAULT 'pending';

DROP TYPE "whatsapp_account_status_old";

CREATE TYPE "whatsapp_onboarding_status" AS ENUM (
    'started',
    'completed',
    'failed',
    'expired'
);

-- ------------------------------------------------------ whatsapp_accounts

ALTER TABLE "whatsapp_accounts"
    RENAME COLUMN "messaging_limit_tier" TO "messaging_limit";

ALTER TABLE "whatsapp_accounts"
    ADD COLUMN "verified_name"   VARCHAR(180),
    ADD COLUMN "subscribed_at"   TIMESTAMPTZ(6),
    ADD COLUMN "last_webhook_at" TIMESTAMPTZ(6),
    ADD COLUMN "last_error"      TEXT;

-- --------------------------------------------------------- webhook_events

-- The idempotency key. `provider_event_id` is nullable and its unique index is
-- therefore partial, which cannot carry idempotency: a message and a status
-- update do not share one id field, so two different events can both leave it
-- null and both insert. This column is NOT NULL and fully unique, so a
-- redelivery is refused by the database rather than by a read-then-write.
ALTER TABLE "webhook_events"
    ADD COLUMN "dedupe_hash"   CHAR(64) NOT NULL,
    ADD COLUMN "attempts"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "next_retry_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "uq_webhook_events_dedupe_hash"
    ON "webhook_events" ("dedupe_hash");

-- The routing column: every inbound event is matched on it before any tenant
-- database can be opened.
CREATE INDEX "ix_webhook_events_phone_number_id"
    ON "webhook_events" ("phone_number_id");

-- The old idempotency key, removed.
--
-- `uq_webhook_event` was a partial unique index on provider_event_id. It is
-- actively wrong now: a status update carries the SAME id as the message it
-- describes, so storing "message wamid.1" made "wamid.1 delivered" a duplicate
-- and `skipDuplicates` dropped it without a word. Every delivery receipt would
-- have been silently lost.
--
-- `dedupe_hash` is the idempotency key. provider_event_id keeps a plain index
-- because looking a message up by it is still useful.
DROP INDEX IF EXISTS "uq_webhook_event";

CREATE INDEX "ix_webhook_events_provider_event_id"
    ON "webhook_events" ("provider_event_id")
    WHERE "provider_event_id" IS NOT NULL;

-- --------------------------------------------- whatsapp_onboarding_sessions

CREATE TABLE "whatsapp_onboarding_sessions" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"           UUID NOT NULL REFERENCES "tenants" ("id") ON DELETE RESTRICT,
    -- Minted server-side. This is what ties the code the browser posts back to
    -- the tenant that started the flow.
    "state_nonce"         VARCHAR(190) NOT NULL,
    "status"              "whatsapp_onboarding_status" NOT NULL DEFAULT 'started',
    -- As the popup reported them, and not trusted: the callback verifies both
    -- against the Graph API before writing whatsapp_accounts.
    "waba_id"             VARCHAR(150),
    "phone_number_id"     VARCHAR(150),
    "error_code"          VARCHAR(60),
    "error_message"       TEXT,
    "expires_at"          TIMESTAMPTZ(6) NOT NULL,
    "consumed_at"         TIMESTAMPTZ(6),
    "whatsapp_account_id" UUID REFERENCES "whatsapp_accounts" ("id") ON DELETE RESTRICT,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "uq_whatsapp_onboarding_state_nonce"
    ON "whatsapp_onboarding_sessions" ("state_nonce");

CREATE INDEX "ix_whatsapp_onboarding_tenant"
    ON "whatsapp_onboarding_sessions" ("tenant_id", "created_at" DESC);

CREATE INDEX "ix_whatsapp_onboarding_expires"
    ON "whatsapp_onboarding_sessions" ("expires_at");
