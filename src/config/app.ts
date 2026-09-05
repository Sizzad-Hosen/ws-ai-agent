/**
 * Product naming follows the UI source of truth: both style guides in
 * `docs/uiux/` name the product "SellPilot AI", and every back-office mockup
 * renders "SellPilot AI / Admin Console" in the sidebar.
 */
export const APP_CONFIG = {
  name: "SellPilot AI",
  shortName: "SellPilot AI",
  consoleName: "Admin Console",
  description: "Back-office administration for the multi-tenant SaaS platform.",
} as const;
