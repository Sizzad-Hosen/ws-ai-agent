/**
 * The tenant workspace's destinations, as plain data.
 *
 * Deliberately free of imports, and of icons in particular. `navigation.ts`
 * pulls in `lucide-react`, which needs a React runtime — so anything outside a
 * component that wants to know which pages the sidebar links to (a check
 * script, a test) could not read the list without booting React.
 *
 * One source of truth: `navigation.ts` attaches an icon to each entry here
 * rather than keeping a second list beside it.
 */

export interface TenantNavigationEntry {
  readonly label: string;
  /** Appended to the tenant's dashboard root. */
  readonly segment: string;
}

export const TENANT_NAVIGATION_ENTRIES: readonly TenantNavigationEntry[] = [
  { label: "Dashboard", segment: "dashboard" },
  { label: "Users", segment: "users" },
  { label: "Customers", segment: "customers" },
  { label: "Products", segment: "products" },
  { label: "Categories", segment: "categories" },
  { label: "Orders", segment: "orders" },
  { label: "WhatsApp", segment: "whatsapp" },
  { label: "AI Usage", segment: "ai-usage" },
  { label: "Settings", segment: "settings" },
];
