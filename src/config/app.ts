/**
 * Product naming source of truth. "Ordivex" is the brand name for the whole
 * system: marketing site, back office, and metadata all read it from here, so
 * a rename is a single edit.
 */
export const APP_CONFIG = {
  name: "Ordivex",
  shortName: "Ordivex",
  consoleName: "Admin Console",
  description: "Back-office administration for the multi-tenant SaaS platform.",
} as const;

/**
 * Single-letter logo mark for the back-office shell, derived from the brand
 * name so the badge can never drift from it.
 */
export const APP_MARK = APP_CONFIG.name.charAt(0);
