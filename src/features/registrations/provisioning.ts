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

/** The tenant site's path on the platform, e.g. "/acme-corp". */
export function tenantPath(subdomain: string): string {
  return `/${subdomain}`;
}

/**
 * The tenant's public site URL.
 *
 * The path form wins when the platform origin is known, because that is the
 * route the application actually serves: `/[tenant]` resolves, and it carries
 * the right scheme and port by construction. The host form
 * (`acme.example.com`) is recorded only when there is no origin to build a path
 * from — it needs wildcard DNS and a proxy that maps the host back to this
 * route, neither of which this application provides.
 *
 * Null only when neither is available. An unroutable URL on the tenants list is
 * worse than an honest blank.
 */
export function buildWebsiteUrl(
  subdomain: string,
  rootDomain: string,
  appUrl = "",
): string | null {
  const base = appUrl.trim().replace(/\/+$/, "");

  if (base !== "") return `${base}${tenantPath(subdomain)}`;

  const root = rootDomain.trim().toLowerCase();
  return root === "" ? null : `https://${subdomain}.${root}`;
}

/**
 * Human-facing tenant reference, matching the seeded TEN-##### shape.
 *
 * Padding keeps the common case aligned; it does not make the codes sortable as
 * text, because no fixed width can once the digit count grows. The next-code
 * lookup therefore compares parsed numbers rather than ordering by the column.
 */
export function formatTenantCode(sequence: number): string {
  const width = sequence > 99_999 ? String(sequence).length : 5;
  return `TEN-${String(sequence).padStart(width, "0")}`;
}
