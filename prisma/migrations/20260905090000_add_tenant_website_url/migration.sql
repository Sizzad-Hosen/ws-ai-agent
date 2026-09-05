-- Public storefront URL for a tenant.
--
-- Not present in the master ERD: added so the tenants list can link out to a
-- tenant's own site from the row action menu. Nullable because a tenant may
-- not have a site yet, and the UI must show that rather than guess a URL.
ALTER TABLE "tenants" ADD COLUMN "website_url" VARCHAR(300);
