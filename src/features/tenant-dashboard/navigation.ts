import {
  Bot,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface TenantNavigationItem {
  readonly label: string;
  /** Appended to the tenant's dashboard root. */
  readonly segment: string;
  readonly icon: LucideIcon;
}

/**
 * Sidebar for a tenant's own workspace.
 *
 * Every destination is scoped to the tenant in the URL; there is no route here
 * that could address another workspace, which is why the sidebar needs no
 * permission filtering of the kind the back office does.
 *
 * Only routes that exist are listed. A sidebar entry for a page nobody has
 * built yet is a 404 with a signpost pointing at it — the shop settings that a
 * "Settings" entry would have held live under Assistant, which is where the
 * storefront they configure is set up.
 */
export const TENANT_NAVIGATION: readonly TenantNavigationItem[] = [
  { label: "Dashboard", segment: "dashboard", icon: LayoutDashboard },
  { label: "Customers", segment: "customers", icon: UsersRound },
  { label: "Products", segment: "products", icon: Package },
  { label: "Categories", segment: "categories", icon: Tags },
  { label: "Orders", segment: "orders", icon: ShoppingCart },
  { label: "Assistant", segment: "assistant", icon: Bot },
];
