import {
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Users,
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
 */
export const TENANT_NAVIGATION: readonly TenantNavigationItem[] = [
  { label: "Dashboard", segment: "dashboard", icon: LayoutDashboard },
  { label: "Users", segment: "users", icon: Users },
  { label: "Customers", segment: "customers", icon: UsersRound },
  { label: "Products", segment: "products", icon: Package },
  { label: "Categories", segment: "categories", icon: Tags },
  { label: "Orders", segment: "orders", icon: ShoppingCart },
  { label: "Settings", segment: "settings", icon: Settings },
];
