-- 002 — profile pictures for tenant staff.
--
-- `users` had no avatar column, so a tenant user could not have a profile
-- picture at all. The master database's `admin_users` and `tenant_users` both
-- carry `avatar_url`; this is the same column for the accounts that actually
-- sign in to a workspace.
--
-- The column holds a URL into the avatar upload base, never file bytes. See
-- src/features/profile/avatar-storage.ts.
--
-- Safe to run twice: a database created from a regenerated 001 baseline
-- already has the column, and this must be a no-op there.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
