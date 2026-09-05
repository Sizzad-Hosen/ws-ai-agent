-- Drop the superseded master schema.
--
-- These tables and enums came from the previous baseline
-- (20260902173259_init_master_schema), which described a different database to
-- the ERD in docs/db. The preceding migration created the ERD schema alongside
-- them; this one removes the old objects so only the documented schema remains.
--
-- Every table below is empty of production data — the previous baseline was
-- only ever applied to local development databases.

DROP TABLE IF EXISTS "TenantFeatureFlag" CASCADE;
DROP TABLE IF EXISTS "FeatureFlag" CASCADE;
DROP TABLE IF EXISTS "UsageSummary" CASCADE;
DROP TABLE IF EXISTS "BillingMetadata" CASCADE;
DROP TABLE IF EXISTS "WhatsappRoutingMetadata" CASCADE;
DROP TABLE IF EXISTS "TenantDatabaseRegistry" CASCADE;
DROP TABLE IF EXISTS "TenantMembership" CASCADE;
DROP TABLE IF EXISTS "TenantUser" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlan" CASCADE;
DROP TABLE IF EXISTS "Tenant" CASCADE;
DROP TABLE IF EXISTS "PlatformAuditLog" CASCADE;
DROP TABLE IF EXISTS "PlatformAiSettings" CASCADE;
DROP TABLE IF EXISTS "PlatformConfiguration" CASCADE;
DROP TABLE IF EXISTS "AdminSession" CASCADE;
DROP TABLE IF EXISTS "PlatformAdmin" CASCADE;

DROP TYPE IF EXISTS "MembershipRole";
DROP TYPE IF EXISTS "MembershipStatus";
DROP TYPE IF EXISTS "PlanStatus";
DROP TYPE IF EXISTS "PlatformAdminRole";
DROP TYPE IF EXISTS "ProvisioningStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "TenantStatus";
DROP TYPE IF EXISTS "AdminStatus";
