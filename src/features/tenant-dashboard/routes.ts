/**
 * Tenant dashboard URLs.
 *
 * Deliberately free of imports. These are needed by the sidebar, which is a
 * Client Component, and by the session code, which is `server-only` — so they
 * cannot live beside either. Putting `tenantBasePath` in the auth module pulled
 * `next/headers` into the browser bundle, which fails at build time rather than
 * at runtime, but only once something imports it from a client component.
 */

/** Root of a tenant's dashboard, and the cookie path that scopes its session. */
export function tenantBasePath(slug: string): string {
  return `/${slug}/tenants_reg`;
}

export function tenantHref(slug: string, segment: string): string {
  return `${tenantBasePath(slug)}/${segment}`;
}
