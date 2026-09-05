-- Who did what in the console.
--
-- Append-only: an audit trail an administrator can edit is not an audit trail,
-- so the application has no update or delete path for these rows.
--
-- actor_id carries no foreign key on purpose. Removing an administrator must
-- not remove, or block the removal of, the record of what they did; actor_email
-- is denormalised so the entry stays readable once the account is gone.
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_email" VARCHAR(190) NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(190),
    "metadata" JSONB,
    "ip_address" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");
CREATE INDEX "platform_audit_logs_entity_type_entity_id_idx" ON "platform_audit_logs"("entity_type", "entity_id");
CREATE INDEX "platform_audit_logs_actor_id_idx" ON "platform_audit_logs"("actor_id");
