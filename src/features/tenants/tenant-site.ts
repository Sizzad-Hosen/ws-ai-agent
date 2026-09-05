import "server-only";

import { env } from "@/config/env";
import type { Tenant } from "@/features/tenants/types";

/**
 * Resolves a tenant's public site URL from the configured template.
 *
 * The ERD stores no per-tenant site URL (D-35), so this is derived from
 * configuration rather than invented per tenant. Returns `null` when no
 * template is configured, and the action renders disabled.
 */
export function tenantSiteUrl(tenant: Tenant): string | null {
  const template = env.TENANT_SITE_URL_TEMPLATE;

  if (!template) {
    return null;
  }

  const resolved = template.replaceAll(
    "{tenantCode}",
    encodeURIComponent(tenant.tenantCode),
  );

  try {
    const url = new URL(resolved);
    // Never emit a non-http scheme into an href built from configuration.
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
