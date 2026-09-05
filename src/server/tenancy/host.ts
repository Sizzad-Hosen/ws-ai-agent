/**
 * Host parsing for tenant routing.
 *
 * Deliberately free of imports. `@/config/env` is `server-only` and would not
 * load in middleware, which runs on the edge runtime, so the root domain is
 * passed in rather than read here. Middleware decides *whether* a request looks
 * tenant-scoped; only the Node runtime resolves *which* tenant, since that
 * needs the database.
 */

/** Labels that are the platform itself and can never name a tenant. */
const RESERVED_LABELS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "bo",
  "mail",
  "static",
  "assets",
  "cdn",
  "status",
  "docs",
]);

/** A DNS label: lowercase alphanumerics and inner hyphens, 1-63 characters. */
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  // Strip the port, and any IPv6 brackets that came with it.
  return host.trim().toLowerCase().split(":")[0]?.replace(/[[\]]/g, "") ?? "";
}

/**
 * Extracts the tenant label from a host, or null when the host addresses the
 * platform itself.
 *
 * Returning null for anything doubtful is deliberate: a wrong answer here
 * serves one tenant's data on another tenant's host, so the failure mode must
 * be "no tenant", never "some tenant".
 */
export function tenantLabelFromHost(
  host: string,
  rootDomain: string,
): string | null {
  const normalized = normalizeHost(host);
  if (normalized === "") return null;

  const root = normalizeHost(rootDomain);
  if (root === "") return null;

  if (normalized === root) return null;
  if (!normalized.endsWith(`.${root}`)) return null;

  const label = normalized.slice(0, -(root.length + 1));

  // Only a single label routes to a tenant; "a.b.example.com" is not "a".
  if (label.includes(".")) return null;
  if (RESERVED_LABELS.has(label)) return null;
  if (!LABEL_PATTERN.test(label)) return null;

  return label;
}

export function isReservedLabel(label: string): boolean {
  return RESERVED_LABELS.has(label.toLowerCase());
}
