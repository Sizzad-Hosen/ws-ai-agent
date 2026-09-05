-- Failed sign-in attempts, for throttling the admin console.
--
-- Not in the master ERD. Recorded per email and per client address; only
-- failures are stored, and a successful sign-in clears that email's history.
-- A row here is not a lockout flag: throttling is a sliding window, so nobody
-- can permanently deny service to a named administrator by guessing badly.
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_attempts_identifier_created_at_idx"
    ON "login_attempts"("identifier", "created_at");
