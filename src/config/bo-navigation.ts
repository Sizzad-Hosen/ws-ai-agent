import { LayoutDashboard, type LucideIcon } from "lucide-react";

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
}

export const BO_NAVIGATION: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.bo.dashboard,
    icon: LayoutDashboard,
    permission: PLATFORM_PERMISSIONS.DASHBOARD_READ,
  },
] as const;
