import {
  Bot,
  ChartNoAxesCombined,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  Phone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";

export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly permission: PlatformPermission;
  /** Additional path prefixes that keep this item highlighted. */
  readonly matches?: readonly string[];
}

/**
 * The mockups contain two competing navigation structures (see D-31 in
 * docs/IMPLEMENTATION_PLAN.md). This uses the flat structure from screens
 * 01/06/07/09, which is the one `src/constants/routes.ts` already follows.
 */
export const BO_NAVIGATION: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.bo.dashboard,
    icon: LayoutDashboard,
    permission: PLATFORM_PERMISSIONS.DASHBOARD_READ,
  },
  {
    label: "Tenants",
    href: ROUTES.bo.tenants,
    icon: Users,
    permission: PLATFORM_PERMISSIONS.TENANTS_READ,
    matches: [ROUTES.bo.registrations],
  },
  {
    label: "Subscriptions",
    href: ROUTES.bo.plans,
    icon: CreditCard,
    permission: PLATFORM_PERMISSIONS.PLANS_READ,
    matches: [ROUTES.bo.subscriptions],
  },
  {
    label: "AI Configuration",
    href: ROUTES.bo.aiSettings,
    icon: Bot,
    permission: PLATFORM_PERMISSIONS.AI_SETTINGS_READ,
  },
  {
    label: "AI Usage",
    href: ROUTES.bo.usage,
    icon: ChartNoAxesCombined,
    permission: PLATFORM_PERMISSIONS.USAGE_READ,
  },
  {
    label: "WhatsApp",
    href: ROUTES.bo.whatsapp,
    icon: Phone,
    permission: PLATFORM_PERMISSIONS.WHATSAPP_READ,
  },
  {
    label: "Messages",
    href: ROUTES.bo.messages,
    icon: MessageSquareText,
    permission: PLATFORM_PERMISSIONS.MESSAGES_READ,
  },
  {
    label: "System Settings",
    href: ROUTES.bo.system,
    icon: SlidersHorizontal,
    permission: PLATFORM_PERMISSIONS.SETTINGS_MANAGE,
  },
] as const;
