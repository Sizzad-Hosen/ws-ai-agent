-- Sign-up date for a tenant registration.
--
-- Not on the ERD. Screen 03 shows a "Submitted" column, and without this it had
-- to stand in with the earliest completed review check — which is NULL for
-- every registration that has not been reviewed yet, so a brand-new application
-- rendered a dash. It also left the queue with no time ordering: rows came back
-- by registration_code, which is not the order applications arrive in.
--
-- Backfilled from the earliest completed check where one exists, so a reviewed
-- registration keeps the date the console was already showing; anything else
-- falls back to now().
ALTER TABLE "tenant_registrations"
    ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "tenant_registrations" AS r
SET "created_at" = c."earliest"
FROM (
    SELECT "tenant_registration_id", MIN("checked_at") AS "earliest"
    FROM "tenant_registration_checks"
    WHERE "checked_at" IS NOT NULL
    GROUP BY "tenant_registration_id"
) AS c
WHERE c."tenant_registration_id" = r."id";

-- Serves the review queue's newest-first ordering.
CREATE INDEX "tenant_registrations_created_at_idx" ON "tenant_registrations"("created_at");
