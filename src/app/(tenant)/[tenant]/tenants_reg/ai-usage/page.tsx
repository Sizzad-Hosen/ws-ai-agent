import type { Metadata } from "next";
import { Bot } from "lucide-react";

import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroller,
} from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { loadTenantAiUsage } from "@/features/tenant-ai-usage/usage-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatCompact, formatNumber, formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "AI Usage",
  robots: { index: false, follow: false },
};

/** Request types are stored as snake_case identifiers, not display text. */
function humanizeRequestType(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "SUCCESS") return "success";
  if (status === "THROTTLED") return "warning";
  return "danger";
}

export default async function TenantAiUsagePage({
  params,
}: PageProps<"/[tenant]/tenants_reg/ai-usage">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);
  const usage = await loadTenantAiUsage(tenant.db);

  const bars = usage.daily.map((point) => ({
    label: point.day.slice(5),
    segments: [point.inputTokens, point.outputTokens] as readonly [
      number,
      number,
    ],
  }));

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="AI Usage"
      description={`What the AI agent has cost ${tenant.businessName} over the last ${usage.windowDays} days.`}
    >
      {usage.requests === 0 ? (
        <EmptyState
          icon={Bot}
          title="No AI usage yet"
          description="Usage appears here once the AI agent answers its first message."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="AI requests"
              value={formatNumber(usage.requests)}
              caption={`Last ${usage.windowDays} days`}
            />
            <MetricCard
              label="Tokens used"
              value={formatCompact(usage.totalTokens)}
              caption={`${formatCompact(usage.inputTokens)} in / ${formatCompact(usage.outputTokens)} out`}
            />
            <MetricCard
              label="Estimated cost"
              value={`$${usage.estimatedCost}`}
              caption="At the platform rate card"
            />
            <MetricCard
              label="Error rate"
              value={`${usage.errorRatePercent}%`}
              caption={`${formatNumber(usage.failedRequests)} of ${formatNumber(usage.requests)} failed`}
              accent={usage.errorRatePercent === 0 ? "success" : "default"}
            />
          </div>

          <Card>
            <CardHeader title="Tokens per day" />
            <CardBody>
              <StackedBarChart
                bars={bars}
                seriesLabels={["Input tokens", "Output tokens"]}
                caption={`Input and output tokens per day over the last ${usage.windowDays} days`}
                formatValue={(value) => formatCompact(value)}
              />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="What the AI was asked to do" />
              <CardBody>
                <TableScroller>
                  <Table>
                    <THead>
                      <TR className="hover:bg-table-header">
                        <TH>Request type</TH>
                        <TH numeric>Requests</TH>
                        <TH numeric>Share</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {usage.byRequestType.map((entry) => (
                        <TR key={entry.requestType}>
                          <TD>{humanizeRequestType(entry.requestType)}</TD>
                          <TD numeric>{formatNumber(entry.requests)}</TD>
                          <TD numeric className="text-muted-foreground">
                            {entry.percent}%
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroller>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Most recent AI calls" />
              <CardBody>
                <TableScroller>
                  <Table>
                    <THead>
                      <TR className="hover:bg-table-header">
                        <TH>When</TH>
                        <TH>Request</TH>
                        <TH numeric>Tokens</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {usage.recent.map((call) => (
                        <TR key={call.id}>
                          <TD className="text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(call.createdAt)}
                          </TD>
                          <TD>{humanizeRequestType(call.requestType)}</TD>
                          <TD numeric>
                            {formatNumber(call.inputTokens + call.outputTokens)}
                          </TD>
                          <TD>
                            <Badge tone={statusTone(call.status)}>
                              {call.status}
                            </Badge>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroller>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </TenantShell>
  );
}
