import type { Metadata } from "next";
import {
  CircleAlert,
  MessageSquare,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UnavailableNotice } from "@/components/shared/unavailable-notice";
import { QuerySelect } from "@/components/shared/query-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Pagination } from "@/components/ui/pagination";
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
import { CHART_SERIES } from "@/components/charts/chart-palette";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  WEBHOOK_STATUS_LABELS,
  WHATSAPP_STATUS_LABELS,
  WHATSAPP_STATUS_TONES,
} from "@/features/tenants/status";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import {
  WHATSAPP_CONNECTION_STATUSES,
  type WebhookStatus,
  type WhatsappConnectionStatus,
  type WhatsappQualityRating,
} from "@/types/status";
import {
  formatCompact,
  formatNumber,
  formatRelativeTime,
} from "@/utils/format";

export const metadata: Metadata = {
  title: "WhatsApp Accounts",
};

const PAGE_SIZE = 20;

const QUALITY_LABELS: Readonly<Record<WhatsappQualityRating, string>> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
  unknown: "N/A",
};

export default async function WhatsappPage({
  searchParams,
}: PageProps<"/bo/whatsapp">) {
  await requirePermission(PLATFORM_PERMISSIONS.WHATSAPP_READ);

  const params = await searchParams;
  const search =
    typeof params.search === "string" ? params.search.trim().slice(0, 100) : "";
  const connectionParam =
    typeof params.connection === "string" ? params.connection : "";
  const rawOffset = typeof params.offset === "string" ? params.offset : "";
  const parsedOffset = Number.parseInt(rawOffset, 10);
  const offset =
    Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const connection = WHATSAPP_CONNECTION_STATUSES.includes(
    connectionParam as WhatsappConnectionStatus,
  )
    ? (connectionParam as WhatsappConnectionStatus)
    : undefined;

  const [result, summary] = await Promise.all([
    repositories.whatsapp.findMany({
      search: search || undefined,
      connection,
      limit: PAGE_SIZE,
      offset,
    }),
    repositories.whatsapp.summary(),
  ]);

  const now = new Date();
  const hasFilters = Boolean(search || connection);

  function buildHref(nextOffset: number): string {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (connection) query.set("connection", connection);
    if (nextOffset > 0) query.set("offset", String(nextOffset));
    const serialized = query.toString();
    return serialized
      ? `${ROUTES.bo.whatsapp}?${serialized}`
      : ROUTES.bo.whatsapp;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Accounts"
        description="Manage and monitor global WhatsApp Business API connections."
        actions={
          <Button
            variant="secondary"
            disabled
            title="Export is not implemented yet."
          >
            Export Data
          </Button>
        }
      />

      {summary === null ? (
        <UnavailableNotice
          title="No connection-health data source"
          description="Connected numbers, webhook errors and per-account health come from a WhatsApp account registry. The master schema has no such table, so none of these figures can be reported."
          reference="§2.2 / D-10"
        />
      ) : (
        <section aria-label="Connection health">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Connected numbers"
              value={formatNumber(summary.connectedCount)}
              delta={
                summary.connectedDeltaPercent === null
                  ? null
                  : { percent: summary.connectedDeltaPercent }
              }
              sparkline={summary.connectedTrend}
            />
            <MetricCard
              label="Disconnected"
              value={formatNumber(summary.disconnectedCount)}
              caption={
                summary.disconnectedCount > 0 ? "Action required" : undefined
              }
              sparkline={summary.disconnectedTrend}
              sparklineColor="var(--destructive)"
              trailing={
                summary.disconnectedCount > 0 ? (
                  <TriangleAlert
                    className="text-destructive size-4"
                    aria-label="Action required"
                  />
                ) : undefined
              }
            />
            <MetricCard
              label="Webhook errors"
              value={formatNumber(summary.webhookErrorsLast24h)}
              caption="Last 24h"
              sparkline={summary.webhookErrorTrend}
              sparklineColor={CHART_SERIES[2]}
            />
            <MetricCard
              label="Messages today"
              value={formatCompact(summary.messagesToday)}
              delta={
                summary.messagesTodayDeltaPercent === null
                  ? null
                  : { percent: summary.messagesTodayDeltaPercent }
              }
              sparkline={summary.messagesTrend}
              sparklineColor={CHART_SERIES[1]}
            />
          </div>
        </section>
      )}

      <Card className="overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-3 border-b px-5 py-4">
          <form className="relative min-w-64 flex-1" role="search">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="wa-search" className="sr-only">
              Search accounts, numbers or Meta IDs
            </label>
            <input
              id="wa-search"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Search accounts, numbers, or Meta IDs…"
              className="border-input bg-card focus-visible:border-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            {connection ? (
              <input type="hidden" name="connection" value={connection} />
            ) : null}
          </form>

          <div className="w-52">
            <QuerySelect
              name="connection"
              value={connectionParam}
              label="Filter by connection status"
              options={[
                { value: "", label: "All Connections" },
                ...WHATSAPP_CONNECTION_STATUSES.map((value) => ({
                  value,
                  label: WHATSAPP_STATUS_LABELS[value],
                })),
              ]}
            />
          </div>
        </div>

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH className="w-12">
                  <span className="sr-only">Connection</span>
                </TH>
                <TH>Tenant / Business</TH>
                <TH>WhatsApp Number</TH>
                <TH>Meta Account ID</TH>
                <TH>Status</TH>
                <TH>Webhook</TH>
                <TH>Quality</TH>
                <TH numeric>Msgs (Today)</TH>
                <TH numeric>Last Event</TH>
              </TR>
            </THead>
            <TBody>
              {result.items.length === 0 ? (
                <TableEmpty
                  colSpan={9}
                  title={
                    hasFilters
                      ? "No accounts match these filters"
                      : "No WhatsApp accounts connected"
                  }
                  description={
                    hasFilters
                      ? "Try a different search term or clear the connection filter."
                      : "Accounts appear here once a tenant links a WhatsApp Business number."
                  }
                />
              ) : (
                result.items.map((account) => (
                  <TR key={account.id}>
                    <TD>
                      <ConnectionIcon status={account.connectionStatus} />
                    </TD>
                    <TD>
                      <span className="block font-medium">
                        {account.tenantName}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {account.displayName}
                      </span>
                    </TD>
                    <TD mono>{account.phoneNumber}</TD>
                    <TD mono className="text-muted-foreground">
                      {account.metaAccountId}
                    </TD>
                    <TD>
                      <Badge
                        tone={WHATSAPP_STATUS_TONES[account.connectionStatus]}
                      >
                        {WHATSAPP_STATUS_LABELS[account.connectionStatus]}
                      </Badge>
                    </TD>
                    <TD>
                      <WebhookCell
                        status={account.webhookStatus}
                        latencyMs={account.webhookLatencyMs}
                      />
                    </TD>
                    <TD>
                      <QualityChip rating={account.qualityRating} />
                    </TD>
                    <TD numeric>
                      {account.messagesToday === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        formatNumber(account.messagesToday)
                      )}
                    </TD>
                    <TD numeric className="text-muted-foreground">
                      {account.lastEventAt
                        ? formatRelativeTime(account.lastEventAt, now)
                        : "—"}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>

        <Pagination
          total={result.total}
          limit={result.limit}
          offset={result.offset}
          buildHref={buildHref}
          variant="simple"
          noun="accounts"
        />
      </Card>
    </div>
  );
}

function ConnectionIcon({
  status,
}: {
  readonly status: WhatsappConnectionStatus;
}) {
  const label = WHATSAPP_STATUS_LABELS[status];

  if (status === "active") {
    return (
      <span
        className="bg-success-container grid size-8 place-items-center rounded-md"
        role="img"
        aria-label={label}
      >
        <MessageSquare className="text-success size-4" aria-hidden="true" />
      </span>
    );
  }

  if (status === "auth_required") {
    return (
      <span
        className="bg-destructive-container grid size-8 place-items-center rounded-md"
        role="img"
        aria-label={label}
      >
        <CircleAlert className="text-destructive size-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className="bg-warning-container grid size-8 place-items-center rounded-md"
      role="img"
      aria-label={label}
    >
      <RefreshCw className="text-warning size-4" aria-hidden="true" />
    </span>
  );
}

function WebhookCell({
  status,
  latencyMs,
}: {
  readonly status: WebhookStatus;
  readonly latencyMs: number | null;
}) {
  const dotTone =
    status === "healthy"
      ? "bg-success"
      : status === "delayed"
        ? "bg-warning"
        : "bg-muted-foreground";

  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span
        className={`size-1.5 shrink-0 rounded-full ${dotTone}`}
        aria-hidden="true"
      />
      <span>
        {WEBHOOK_STATUS_LABELS[status]}
        {latencyMs !== null && status !== "healthy" ? (
          <span className="text-muted-foreground tabular">
            {" "}
            ({(latencyMs / 1000).toFixed(1)}s)
          </span>
        ) : null}
      </span>
    </span>
  );
}

function QualityChip({ rating }: { readonly rating: WhatsappQualityRating }) {
  const tone =
    rating === "green"
      ? "success"
      : rating === "yellow"
        ? "warning"
        : rating === "red"
          ? "danger"
          : "neutral";

  return (
    <Badge shape="tag" tone={tone}>
      {QUALITY_LABELS[rating]}
    </Badge>
  );
}
