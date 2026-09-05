import { CalendarDays } from "lucide-react";

import { TrendAreaChart } from "@/components/charts/trend-area-chart";
import { ChartLegend } from "@/components/charts/chart-frame";
import { CHART_SERIES } from "@/components/charts/chart-palette";
import { PageHeader } from "@/components/shared/page-header";
import { QuerySelect } from "@/components/shared/query-select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_RANGE_LABELS,
  DASHBOARD_RANGES,
  type DashboardRange,
  type DashboardSummary,
} from "@/features/dashboard/types";
import { cn } from "@/lib/utils";
import { formatCompact, formatMoney, formatRelativeTime } from "@/utils/format";

import { ActivityFeed } from "./activity-feed";
import { MessageVolumeChart } from "./message-volume-chart";

interface PlatformOverviewProps {
  readonly summary: DashboardSummary;
  readonly range: DashboardRange;
}

export function PlatformOverview({ summary, range }: PlatformOverviewProps) {
  const now = new Date(summary.generatedAt);

  const mrrPoints = summary.mrrSeries.map((point) => ({
    label: point.month,
    actual: point.actual,
    projected: point.projected,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="High-level telemetry and financial metrics across all active tenants."
        actions={
          <>
            <Button variant="secondary">Export Data</Button>
            <div className="flex items-center gap-2">
              <CalendarDays
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
              <QuerySelect
                name="range"
                value={range}
                label="Reporting period"
                resets={[]}
                options={DASHBOARD_RANGES.map((option) => ({
                  value: option,
                  label: DASHBOARD_RANGE_LABELS[option],
                }))}
                className="w-40"
              />
            </div>
          </>
        }
      />

      <section aria-label="Platform metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.kpis.map((kpi) =>
            kpi.unavailableReason ? (
              <UnavailableMetric
                key={kpi.key}
                label={kpi.label}
                reason={kpi.unavailableReason}
              />
            ) : (
              <MetricCard
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                accent={kpi.accent}
                delta={
                  kpi.deltaPercent === null
                    ? null
                    : { percent: kpi.deltaPercent }
                }
              />
            ),
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="MRR Growth" />
          <CardBody>
            <TrendAreaChart
              points={mrrPoints}
              caption="Monthly recurring revenue, actual and projected"
              formatValue={(value) =>
                formatMoney(value, "USD", { compact: true }) ?? "—"
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Message Volume" />
          <CardBody className="space-y-4">
            <ChartLegend
              entries={[
                { label: "AI Engine", color: CHART_SERIES[0] },
                { label: "WhatsApp", color: CHART_SERIES[1] },
              ]}
            />
            <MessageVolumeChart
              points={summary.messageVolume}
              formatValue={formatCompact}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Platform Activity"
            description="Recent privileged actions and system events."
          />
          <CardBody>
            <ActivityFeed entries={summary.activity} now={now} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reporting freshness" />
          <CardBody className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Figures are served from pre-aggregated rollups, never by querying
              tenant databases at request time.
            </p>
            <p className="text-muted-foreground text-sm">
              Generated{" "}
              <span className="text-foreground font-medium">
                {formatRelativeTime(summary.generatedAt, now)}
              </span>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/**
 * A KPI whose data source has not been defined yet renders as explicitly
 * unavailable. Showing a plausible number with nothing behind it would be worse
 * than showing nothing.
 */
function UnavailableMetric({
  label,
  reason,
}: {
  readonly label: string;
  readonly reason: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col justify-between rounded-md border border-dashed p-5",
      )}
    >
      <p className="text-label-md text-muted-foreground uppercase">{label}</p>
      <div className="mt-4">
        <p className="text-headline-md text-muted-foreground">—</p>
        <p className="text-muted-foreground mt-1 text-xs">{reason}</p>
      </div>
    </div>
  );
}
