-- Host label that routes to a tenant, e.g. "acme" in acme.example.com.
--
-- Not in the master ERD. Multi-tenant request routing needs an explicit
-- host -> tenant mapping: deriving one from the business name or tenant code
-- breaks on rename and cannot guarantee a valid, unique DNS label. Nullable
-- because a tenant may not have been assigned a host yet; unique because two
-- tenants answering on one host is a data-leak class of bug, so the database
-- refuses it rather than trusting application code to check.
ALTER TABLE "tenants" ADD COLUMN "subdomain" VARCHAR(63);

CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");
