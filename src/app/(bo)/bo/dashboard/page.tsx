import type { Metadata } from "next";

import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { requireBoAdmin } from "@/server/auth/authorization";
import { services } from "@/server/services";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  await requireBoAdmin();
  const summary = await services.dashboard.getSummary();

  return <DashboardOverview summary={summary} />;
}
