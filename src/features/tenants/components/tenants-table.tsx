import Link from "next/link";
import { CircleAlert, CircleCheck, MessageSquareOff } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ROUTES } from "@/constants/routes";
import type { TenantListItem } from "@/features/tenants/types";
import {
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
  WHATSAPP_STATUS_LABELS,
} from "@/features/tenants/status";
import { formatMoney, formatNumber } from "@/utils/format";
import type { WhatsappConnectionStatus } from "@/types/status";

const COLUMN_COUNT = 10;

interface TenantsTableProps {
  readonly items: readonly TenantListItem[];
  readonly hasFilters: boolean;
}

export function TenantsTable({ items, hasFilters }: TenantsTableProps) {
  return (
    <TableScroller>
      <Table>
        <THead>
          <TR className="hover:bg-table-header">
            <TH className="w-10">
              <Checkbox aria-label="Select all tenants on this page" />
            </TH>
            <TH>Business / ID</TH>
            <TH>Owner</TH>
            <TH>Plan</TH>
            <TH>WhatsApp</TH>
            <TH>AI Status</TH>
            <TH numeric>Messages</TH>
            <TH numeric>Orders</TH>
            <TH numeric>MRR</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {items.length === 0 ? (
            <TableEmpty
              colSpan={COLUMN_COUNT}
              title={
                hasFilters ? "No tenants match these filters" : "No tenants yet"
              }
              description={
                hasFilters
                  ? "Try widening the search or clearing one of the filters."
                  : "Approved registrations appear here once provisioning starts."
              }
            />
          ) : (
            items.map(({ tenant, planName, metrics }) => (
              <TR key={tenant.id}>
                <TD>
                  <Checkbox aria-label={`Select ${tenant.businessName}`} />
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={tenant.businessName} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={ROUTES.bo.tenant(tenant.id)}
                        className="text-foreground hover:text-primary-deep block truncate font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {tenant.businessName}
                      </Link>
                      <span className="text-muted-foreground tabular block text-xs">
                        {tenant.tenantCode}
                      </span>
                    </div>
                  </div>
                </TD>
                <TD mono className="text-muted-foreground">
                  {tenant.ownerEmail}
                </TD>
                <TD>
                  {planName ? (
                    <Badge shape="tag" tone="info">
                      {planName}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD>
                  <WhatsappIcon status={metrics.whatsappStatus} />
                </TD>
                <TD>
                  <AiStatus online={metrics.aiOnline} />
                </TD>
                <TD numeric>
                  {metrics.messages === null
                    ? "—"
                    : formatNumber(metrics.messages)}
                </TD>
                <TD numeric>
                  {metrics.orders === null ? "—" : formatNumber(metrics.orders)}
                </TD>
                <TD numeric>
                  {formatMoney(metrics.mrr, metrics.currency) ?? "—"}
                </TD>
                <TD>
                  <Badge tone={TENANT_STATUS_TONES[tenant.approvalStatus]}>
                    {TENANT_STATUS_LABELS[tenant.approvalStatus]}
                  </Badge>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </TableScroller>
  );
}

function WhatsappIcon({
  status,
}: {
  readonly status: WhatsappConnectionStatus | null;
}) {
  if (status === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const label = WHATSAPP_STATUS_LABELS[status];

  if (status === "active") {
    return <CircleCheck className="text-success size-5" aria-label={label} />;
  }

  if (status === "auth_required") {
    return <CircleAlert className="text-warning size-5" aria-label={label} />;
  }

  return (
    <MessageSquareOff
      className="text-muted-foreground size-5"
      aria-label={label}
    />
  );
}

function AiStatus({ online }: { readonly online: boolean | null }) {
  if (online === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span
        className={
          online
            ? "bg-success size-1.5 rounded-full"
            : "bg-muted-foreground size-1.5 rounded-full"
        }
        aria-hidden="true"
      />
      <span className="tabular">{online ? "Active" : "Paused"}</span>
    </span>
  );
}
