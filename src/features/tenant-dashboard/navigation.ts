import {
  Bot,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import {
  TENANT_NAVIGATION_ENTRIES,
  type TenantNavigationEntry,
} from "./nav-segments";

export interface TenantNavigationItem extends TenantNavigationEntry {
  readonly icon: LucideIcon;
}

/**
 * Icon per destination.
 *
 * Keyed by segment and typed as a total record, so adding a destination to
 * `nav-segments.ts` without giving it an icon is a compile error rather than a
 * blank square in the sidebar.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  dashboard: LayoutDashboard,
  users: Users,
  customers: UsersRound,
  products: Package,
  categories: Tags,
  orders: ShoppingCart,
  "ai-usage": Bot,
  settings: Settings,
};

/**
 * Sidebar for a tenant's own workspace.
 *
 * Every destination is scoped to the tenant in the URL; there is no route here
 * that could address another workspace, which is why the sidebar needs no
 * permission filtering of the kind the back office does.
 *
 * `npm run verify:tenant-pages` asserts that every entry has a page file, so a
 * link added here without a route fails a check rather than reaching a user as
 * a 404.
 */
export const TENANT_NAVIGATION: readonly TenantNavigationItem[] =
  TENANT_NAVIGATION_ENTRIES.map((entry) => ({
    ...entry,
    icon: ICONS[entry.segment] ?? LayoutDashboard,
  }));
