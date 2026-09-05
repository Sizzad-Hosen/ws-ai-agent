import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ListFilter } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UnavailableNotice } from "@/components/shared/unavailable-notice";
import { QuerySelect } from "@/components/shared/query-select";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Tabs } from "@/components/ui/tabs";
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
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import {
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  type MessageDirection,
  type MessageStatus,
} from "@/types/status";
import { formatLatency, formatNumber, formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "Message Monitoring",
};

const PAGE_SIZE = 20;

const DIRECTION_LABELS: Readonly<Record<MessageDirection, string>> = {
  inbound: "In",
  outbound: "Out",
};

const STATUS_LABELS: Readonly<Record<MessageStatus, string>> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

const STATUS_TONES: Readonly<Record<MessageStatus, BadgeTone>> = {
  queued: "neutral",
  sent: "neutral",
  delivered: "success",
  read: "info",
  failed: "danger",
};

export default async function MessagesPage({
  searchParams,
}: PageProps<"/bo/messages">) {
  await requirePermission(PLATFORM_PERMISSIONS.MESSAGES_READ);

  const params = await searchParams;
  const directionParam =
    typeof params.direction === "string" ? params.direction : "";
  const statusParam = typeof params.status === "string" ? params.status : "";
  const tenantParam = typeof params.tenant === "string" ? params.tenant : "";
  const failedOnly = params.tab === "failed";
  const rawOffset = typeof params.offset === "string" ? params.offset : "";
  const parsedOffset = Number.parseInt(rawOffset, 10);
  const offset =
    Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const direction = MESSAGE_DIRECTIONS.includes(
    directionParam as MessageDirection,
  )
    ? (directionParam as MessageDirection)
    : undefined;
  const status = MESSAGE_STATUSES.includes(statusParam as MessageStatus)
    ? (statusParam as MessageStatus)
    : undefined;

  const [feed, tenantOptions] = await Promise.all([
    repositories.messages.findMany({
      direction,
      status,
      tenantId: tenantParam || undefined,
      failedOnly,
      limit: PAGE_SIZE,
      offset,
    }),
    repositories.messages.listTenantOptions(),
  ]);

  function buildHref(nextOffset: number, tab?: "failed"): string {
    const query = new URLSearchParams();
    if (direction) query.set("direction", direction);
    if (status) query.set("status", status);
    if (tenantParam) query.set("tenant", tenantParam);
    if (tab ?? (failedOnly ? "failed" : undefined)) query.set("tab", "failed");
    if (nextOffset > 0) query.set("offset", String(nextOffset));
    const serialized = query.toString();
    return serialized
      ? `${ROUTES.bo.messages}?${serialized}`
      : ROUTES.bo.messages;
  }

  const allTabHref = (() => {
    const query = new URLSearchParams();
    if (direction) query.set("direction", direction);
    if (status) query.set("status", status);
    if (tenantParam) query.set("tenant", tenantParam);
    const serialized = query.toString();
    return serialized
      ? `${ROUTES.bo.messages}?${serialized}`
      : ROUTES.bo.messages;
  })();

  if (feed === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Message Monitoring"
          description="Real-time log of AI and system communications."
          actions={
            <Button variant="secondary" disabled>
              Export Logs
            </Button>
          }
        />
        <UnavailableNotice
          title="No message store configured"
          description="The cross-tenant message log has no home in the master schema, and at the documented volume it should not live in the master OLTP database. Until that store is chosen there is nothing to read — which is not the same as no traffic."
          reference="§2.2 / D-11"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message Monitoring"
        description="Real-time log of AI and system communications."
        actions={<Button variant="secondary">Export Logs</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <ListFilter className="size-4" aria-hidden="true" />
            Filters
          </span>
          <span className="bg-border mx-1 h-6 w-px" aria-hidden="true" />

          <div className="w-44">
            <QuerySelect
              name="direction"
              value={directionParam}
              label="Filter by direction"
              options={[
                { value: "", label: "Direction: All" },
                ...MESSAGE_DIRECTIONS.map((value) => ({
                  value,
                  label: DIRECTION_LABELS[value],
                })),
              ]}
            />
          </div>

          <div className="w-44">
            <QuerySelect
              name="status"
              value={statusParam}
              label="Filter by status"
              options={[
                { value: "", label: "Status: All" },
                ...MESSAGE_STATUSES.map((value) => ({
                  value,
                  label: STATUS_LABELS[value],
                })),
              ]}
            />
          </div>

          <div className="w-52">
            <QuerySelect
              name="tenant"
              value={tenantParam}
              label="Filter by tenant"
              options={[
                { value: "", label: "Tenant: All" },
                ...tenantOptions.map((option) => ({
                  value: option.id,
                  label: option.name,
                })),
              ]}
            />
          </div>

          <span className="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
            Live Feed
            <span
              className="bg-success size-2 animate-pulse rounded-full"
              aria-hidden="true"
            />
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Tabs
          label="Message views"
          items={[
            {
              label: "All Messages",
              href: allTabHref,
              active: !failedOnly,
            },
            {
              label: "Failed Messages",
              href: buildHref(0, "failed"),
              active: failedOnly,
              badge:
                feed.failedCount > 0 ? (
                  <Badge tone="danger">{feed.failedCount}</Badge>
                ) : undefined,
            },
          ]}
        />

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Message ID</TH>
                <TH>Tenant</TH>
                <TH>Direction</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH numeric>Latency</TH>
                <TH>Timestamp</TH>
              </TR>
            </THead>
            <TBody>
              {feed.items.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  title={
                    failedOnly
                      ? "No failed messages"
                      : "No messages match these filters"
                  }
                  description={
                    failedOnly
                      ? "Delivery failures appear here for triage."
                      : "Widen the time range or clear a filter."
                  }
                />
              ) : (
                feed.items.map((message) => (
                  <TR
                    key={message.id}
                    className={
                      message.status === "failed"
                        ? "bg-destructive-container/25"
                        : undefined
                    }
                  >
                    <TD mono className="text-muted-foreground">
                      {message.id}
                    </TD>
                    <TD>{message.tenantName}</TD>
                    <TD>
                      <DirectionCell direction={message.direction} />
                    </TD>
                    <TD mono>
                      {message.customerIdentifier}
                      {message.customerIdentifierMasked ? (
                        <span className="sr-only"> (masked)</span>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONES[message.status]}>
                        {STATUS_LABELS[message.status]}
                      </Badge>
                    </TD>
                    <TD numeric>{formatLatency(message.latencyMs)}</TD>
                    <TD mono className="text-muted-foreground">
                      {formatTimestamp(message.occurredAt)}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>

        <Pagination
          total={feed.total}
          limit={feed.limit}
          offset={feed.offset}
          buildHref={(nextOffset) => buildHref(nextOffset)}
          variant="simple"
          noun="messages"
        />
      </Card>

      <p className="text-muted-foreground text-xs">
        Customer identifiers are masked by default. Revealing one requires the{" "}
        <code className="tabular">messages:read_pii</code> permission and is
        recorded in the audit log. {formatNumber(feed.total)} messages match the
        current filters.
      </p>
    </div>
  );
}

function DirectionCell({
  direction,
}: {
  readonly direction: MessageDirection;
}) {
  const inbound = direction === "inbound";
  const Icon = inbound ? ArrowDown : ArrowUp;

  return (
    <span
      className={
        inbound
          ? "text-info inline-flex items-center gap-1.5 text-[13px]"
          : "text-success inline-flex items-center gap-1.5 text-[13px]"
      }
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {DIRECTION_LABELS[direction]}
    </span>
  );
}
