import type { Metadata } from "next";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { PlatformOverview } from "@/features/dashboard/components/platform-overview";
import {
  DASHBOARD_RANGES,
  type DashboardRange,
} from "@/features/dashboard/types";
import { requirePermission } from "@/server/auth/authorization";
import { services } from "@/server/services";

export const metadata: Metadata = {
  title: "Platform Overview",
};

function parseRange(value: string | undefined): DashboardRange {
  return DASHBOARD_RANGES.includes(value as DashboardRange)
    ? (value as DashboardRange)
    : "30d";
}

export default async function DashboardPage({
  searchParams,
}: PageProps<"/bo/dashboard">) {
  await requirePermission(PLATFORM_PERMISSIONS.DASHBOARD_READ);

  const params = await searchParams;
  const range = parseRange(
    typeof params.range === "string" ? params.range : undefined,
  );
  const summary = await services.dashboard.getSummary(range);

  return <PlatformOverview summary={summary} range={range} />;
}
