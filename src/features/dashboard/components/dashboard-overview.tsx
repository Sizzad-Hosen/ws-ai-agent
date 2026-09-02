import type { DashboardSummary } from "@/features/dashboard/types";

import { MetricCard } from "./metric-card";

interface DashboardOverviewProps {
  readonly summary: DashboardSummary;
}

export function DashboardOverview({ summary }: DashboardOverviewProps) {
  return (
    <section aria-labelledby="platform-overview-title">
      <div>
        <p className="text-primary text-sm font-medium">Back office</p>
        <h1
          id="platform-overview-title"
          className="mt-1 text-2xl font-semibold tracking-tight"
        >
          Platform overview
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Master-level tenants, subscriptions, plans, and administrators. Tenant
          operational data remains isolated from this application.
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
    </section>
  );
}
