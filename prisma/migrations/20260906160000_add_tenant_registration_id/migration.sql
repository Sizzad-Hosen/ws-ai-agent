-- Links a tenant to the application it was provisioned from (§2.5 / D-02).
--
-- The ERD models no relationship in either direction, so screen 04's "Reg: …"
-- field had nothing to read and was rendered blank.
--
-- Nullable: a tenant may also be created directly, bypassing registration.
-- Unique: one application provisions at most one tenant.
-- SET NULL on delete: removing an application must never remove the live tenant
-- it produced; the tenant simply stops citing a registration.
ALTER TABLE "tenants" ADD COLUMN "registration_id" UUID;

ALTER TABLE "tenants"
    ADD CONSTRAINT "tenants_registration_id_key" UNIQUE ("registration_id");

ALTER TABLE "tenants"
    ADD CONSTRAINT "tenants_registration_id_fkey"
    FOREIGN KEY ("registration_id") REFERENCES "tenant_registrations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
