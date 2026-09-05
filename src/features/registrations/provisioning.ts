/**
 * Identifiers derived when an approved registration becomes a tenant.
 *
 * Pure on purpose: what a tenant is *called* is domain logic and must be
 * predictable, while whether that name is free is a database question handled
 * by the repository inside the provisioning transaction.
 */

/** Longest DNS label, and the ceiling on `tenants.subdomain`. */
const MAX_LABEL = 63;

/**
 * Host label for a business name.
 *
 * Returns null when nothing usable survives — a name written entirely in a
 * non-Latin script, for example. Provisioning then asks for one explicitly
 * rather than inventing a label the owner would not recognise.
 */
export function deriveSubdomain(businessName: string): string | null {
  const label = businessName
    .normalize("NFKD")
    // Strip diacritics so "Café" becomes "cafe" rather than losing the letter.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LABEL)
    .replace(/-+$/, "");

  return label === "" ? null : label;
}

/**
 * Appends a numeric suffix while keeping inside the DNS label limit, for the
 * second "Acme Corp" to register.
 */
export function withSuffix(label: string, attempt: number): string {
  if (attempt <= 1) return label;

  const suffix = `-${attempt}`;
  const room = MAX_LABEL - suffix.length;

  return `${label.slice(0, room).replace(/-+$/, "")}${suffix}`;
}

/** Physical database name. Prefixed so tenant databases are obvious on a shared server. */
export function deriveDatabaseName(subdomain: string): string {
  return `sp_tenant_${subdomain.replace(/-/g, "_")}`.slice(0, 150);
}

/**
 * The tenant's public site URL.
 *
 * Null when no root domain is configured: an unroutable URL on the tenants list
 * is worse than an honest blank, and the row action already says "No site URL
 * on file".
 */
export function buildWebsiteUrl(
  subdomain: string,
  rootDomain: string,
): string | null {
  const root = rootDomain.trim().toLowerCase();
  return root === "" ? null : `https://${subdomain}.${root}`;
}

/** Human-facing tenant reference, matching the seeded TEN-##### shape. */
export function formatTenantCode(sequence: number): string {
  return `TEN-${String(sequence).padStart(5, "0")}`;
}
