-- Manual onboarding: a tenant connects a number from their own Meta app.
--
-- Embedded Signup stays the default path and is untouched by this migration.
-- Manual onboarding is the fallback for an owner whose Facebook account is
-- advertising-restricted, or who already runs their own Meta app. The two
-- differ in one way that reaches the webhook: a tenant's own app signs
-- deliveries with that app's secret, not the platform's.

-- How far the tenant has reached in the five-step connect wizard.
--
-- The row is the only thing that survives a closed tab, so progress lives here
-- rather than in a cookie or in component state. 1 is the first screen, which
-- is also what every existing row means: none of them has seen the wizard.
ALTER TABLE "whatsapp_accounts"
    ADD COLUMN "setup_step" smallint NOT NULL DEFAULT 1;

ALTER TABLE "whatsapp_accounts"
    ADD CONSTRAINT "ck_whatsapp_accounts_setup_step"
    CHECK ("setup_step" BETWEEN 1 AND 5);

-- Which path produced this row.
--
-- Not an enum type: master-db.sql models none, and inventing one commits the
-- schema to a set of paths before the second one has shipped. The check
-- constraint carries the same guarantee and is cheaper to widen.
--
-- Every existing row came from Embedded Signup, which is why that is the
-- default rather than 'manual'.
ALTER TABLE "whatsapp_accounts"
    ADD COLUMN "onboarding_method" varchar(20) NOT NULL DEFAULT 'embedded_signup';

ALTER TABLE "whatsapp_accounts"
    ADD CONSTRAINT "ck_whatsapp_accounts_onboarding_method"
    CHECK ("onboarding_method" IN ('embedded_signup', 'manual', 'sandbox'));

-- The platform's own test number, lent to a tenant who has not connected one.
--
-- It carries a real consequence rather than a label: a sandbox row rides the
-- platform's Meta app, so its deliveries are signed with the platform secret
-- and a 401 on one of them would disable the subscription every tenant shares.
ALTER TABLE "whatsapp_accounts"
    ADD COLUMN "is_sandbox" boolean NOT NULL DEFAULT false;

-- The tenant's own Meta app secret, encrypted rather than pointed at.
--
-- It mirrors `access_token_encrypted` deliberately, and for the reason
-- 20260913120000_whatsapp_token_at_rest gives: this deployment has no secret
-- manager, so `app_secret_reference` — which is still here, still unused —
-- would resolve to nothing in production. A column named `*_reference` that
-- holds a secret is one somebody later logs believing it is an identifier.
--
-- Null for a row on the platform app: those verify against META_APP_SECRET.
ALTER TABLE "whatsapp_accounts"
    ADD COLUMN "app_secret_encrypted" text;

-- Whether a plan may borrow the platform's sandbox number.
--
-- Read by the wizard's first screen, which offers the skip only when this is
-- true. False everywhere until an administrator turns it on for a tier.
ALTER TABLE "plans"
    ADD COLUMN "allows_sandbox" boolean NOT NULL DEFAULT false;
