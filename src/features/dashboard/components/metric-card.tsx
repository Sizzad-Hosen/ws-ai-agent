import type { DashboardMetric } from "@/features/dashboard/types";
import { formatNumber } from "@/utils/format-number";

interface MetricCardProps {
  readonly metric: DashboardMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className="bg-card rounded-lg border p-5 shadow-sm">
      <p className="text-muted-foreground text-sm font-medium">
        {metric.label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {formatNumber(metric.value)}
      </p>
      <p className="text-muted-foreground mt-2 text-sm">{metric.description}</p>
    </article>
  );
}
