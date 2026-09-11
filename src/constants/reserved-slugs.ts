/**
 * Path segments a tenant may never claim.
 *
 * Tenant sites are served from the application root (`/clickeibazar`), so a
 * tenant slug shares a namespace with every top-level route. Next.js resolves a
 * static route before a dynamic one, so a tenant that managed to claim
 * "pricing" would not shadow the marketing page — it would simply be
 * unreachable, with no error anywhere to explain why.
 *
 * Kept deliberately wide: `bo`, `api` and the marketing pages are the routes
 * that exist today, and the rest are segments this application is likely to
 * want later. Losing a candidate slug costs a tenant one suffix; losing the
 * route costs everyone the page.
 */
export const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set([
  // Routes that exist today.
  "about",
  "api",
  "bo",
  "demo",
  "faq",
  "how-it-works",
  "pricing",
  "register",
  "solutions",
  // Next.js and web conventions.
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "static",
  "public",
  "assets",
  // Reserved for the platform.
  "admin",
  "app",
  "auth",
  "billing",
  "blog",
  "cdn",
  "contact",
  "dashboard",
  "docs",
  "help",
  "legal",
  "login",
  "logout",
  "mail",
  "privacy",
  "settings",
  "signin",
  "signup",
  "status",
  "support",
  "terms",
  "tenant",
  "tenants",
  "www",
]);

export function isReservedTenantSlug(slug: string): boolean {
  return RESERVED_TENANT_SLUGS.has(slug.toLowerCase());
}
