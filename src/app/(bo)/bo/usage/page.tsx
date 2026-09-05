import type { Metadata } from "next";

import { DonutChart } from "@/components/charts/donut-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { PageHeader } from "@/components/shared/page-header";
import { QuerySelect } from "@/components/shared/query-select";
import { UnavailableNotice } from "@/components/shared/unavailable-notice";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Sparkline } from "@/components/ui/sparkline";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  TableScroller,
} from "@/components/ui/table";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import {
  USAGE_TIMEFRAMES,
  USAGE_TIMEFRAME_LABELS,
  type UsageTimeframe,
} from "@/features/usage/types";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import {
  formatCompact,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/utils/format";

export const metadata: Metadata = {
  title: "AI Usage",
};

function parseTimeframe(value: string | undefined): UsageTimeframe {
  return USAGE_TIMEFRAMES.includes(value as UsageTimeframe)
    ? (value as UsageTimeframe)
    : "30d";
}

export default async function UsagePage({
  searchParams,
}: PageProps<"/bo/usage">) {
  await requirePermission(PLATFORM_PERMISSIONS.USAGE_READ);

  const params = await searchParams;
  const timeframe = parseTimeframe(
    typeof params.timeframe === "string" ? params.timeframe : undefined,
  );
  const summary = await repositories.usage.summary(timeframe);
  const now = new Date();

  const header = (
    <PageHeader
      title="AI Usage"
      description="Cost and consumption metrics across all tenants."
      actions={
        <>
          <Button
            variant="secondary"
            disabled
            title="Export is not implemented yet."
          >
            Export Data
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Timeframe:</span>
            <QuerySelect
              name="timeframe"
              value={timeframe}
              label="Usage timeframe"
              resets={[]}
              options={USAGE_TIMEFRAMES.map((option) => ({
                value: option,
                label: USAGE_TIMEFRAME_LABELS[option],
              }))}
              className="w-40"
            />
          </div>
        </>
      }
    />
  );

  if (summary === null) {
    return (
      <div className="space-y-6">
        {header}
        <UnavailableNotice
          title="No AI usage data source"
          description="Cost, token consumption and per-tenant usage are served from daily rollups. The master schema has no usage table, so there is nothing to report — which is not the same as zero usage."
          reference="§2.2 / D-10"
        />
      </div>
    );
  }

  // Output sits on the baseline, input stacks above it.
  const bars = summary.tokenSeries.map((point) => ({
    label: point.day,
    segments: [point.tokensOut, point.tokensIn] satisfies [number, number],
  }));

  return (
    <div className="space-y-6">
      {header}

      <section aria-label="Usage metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            className="xl:col-span-2"
            label="Estimated AI Cost"
            value={formatMoney(summary.estimatedCost, summary.currency) ?? "—"}
            delta={
              summary.costDeltaPercent === null
                ? null
                : { percent: summary.costDeltaPercent }
            }
          />
          <MetricCard
            label="AI Requests"
            value={formatCompact(summary.requests)}
          />
          <MetricCard
            label="Avg Cost/Conv"
            value={
              formatMoney(
                summary.averageCostPerConversation,
                summary.currency,
              ) ?? "—"
            }
          />
          <MetricCard
            label="Input Tokens"
            value={formatCompact(summary.inputTokens)}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Token Usage"
            description={`Updated ${formatRelativeTime(summary.asOf, now)}`}
          />
          <CardBody>
            <StackedBarChart
              bars={bars}
              seriesLabels={["Output", "Input"]}
              caption="Input and output tokens per day"
              formatValue={formatCompact}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Model Distribution" />
            <CardBody>
              <DonutChart
                slices={summary.modelDistribution.map((share) => ({
                  label: share.modelName,
                  percent: share.percent,
                }))}
                caption="Share of requests by model"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Cost Trend"
              actions={
                <span className="text-muted-foreground text-xs">
                  AI errors {formatPercent(summary.errorRatePercent, 2)}
                </span>
              }
            />
            <CardBody>
              <Sparkline
                points={summary.costSeries.map((point) => point.cost)}
                filled
                className="h-16"
                label="Estimated cost trend"
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Tenant Usage"
          description="Consumption per tenant for the selected timeframe."
        />
        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Tenant</TH>
                <TH numeric>Messages</TH>
                <TH numeric>Tokens (In/Out)</TH>
                <TH numeric>Est. Cost</TH>
              </TR>
            </THead>
            <TBody>
              {summary.tenantUsage.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="No tenant usage in this period"
                  description="Usage appears once tenants start processing messages."
                />
              ) : (
                summary.tenantUsage.map((row) => (
                  <TR key={row.tenantId}>
                    <TD className="font-medium">{row.tenantName}</TD>
                    <TD numeric>{formatNumber(row.messages)}</TD>
                    <TD numeric>
                      {formatCompact(row.tokensIn)} /{" "}
                      {formatCompact(row.tokensOut)}
                    </TD>
                    <TD numeric>
                      {formatMoney(row.estimatedCost, row.currency) ?? "—"}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>
      </Card>
    </div>
  );
}
