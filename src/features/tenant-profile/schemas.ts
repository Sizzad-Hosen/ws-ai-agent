import { z } from "zod";

/**
 * Validation for a tenant user's own profile.
 *
 * Narrower than the back office's equivalent on purpose. An administrator may
 * change their own email; a tenant user may not, and the reason is not
 * squeamishness. The address is duplicated in the master database — on
 * `tenant_users.email` and, for an owner, on `tenants.owner_email` — and those
 * rows live in a different database, so a change here could not be made atomic
 * with them. A form that silently desynchronises three tables is worse than no
 * form, so `email` is displayed and not editable.
 *
 * `status` is absent for the same reason it is absent from the back office
 * schema: a profile form must not let an account change its own standing.
 * `.strict()` rejects it rather than ignoring it.
 */

/** Matches `users.name`, varchar(120), in the tenant schema. */
export const tenantProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(120, "Name must be 120 characters or fewer."),
  })
  .strict();

export type TenantProfile = z.infer<typeof tenantProfileSchema>;
