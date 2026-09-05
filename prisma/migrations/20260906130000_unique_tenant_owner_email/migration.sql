-- One owner email is one tenant.
--
-- Provisioning already checked for an existing tenant before writing, but that
-- read sat outside the transaction, so two reviewers approving duplicate
-- registrations at the same moment could both pass it and each create a tenant,
-- a database record and a subscription for the same customer. The check is now
-- inside the transaction; this constraint is what makes it safe.
CREATE UNIQUE INDEX "tenants_owner_email_key" ON "tenants"("owner_email");
