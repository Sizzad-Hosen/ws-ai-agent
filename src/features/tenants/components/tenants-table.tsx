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
import type {
  PendingTenantApplication,
  TenantListItem,
} from "@/features/tenants/types";
import {
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
  WHATSAPP_STATUS_LABELS,
} from "@/features/tenants/status";
import { tenantDisplayStatus } from "@/types/status";
import type { WhatsappConnectionStatus } from "@/types/status";

import { PendingApplicationActions } from "./pending-application-actions";
import { TenantRowActions } from "./tenant-row-actions";

const COLUMN_COUNT = 7;

interface TenantsTableProps {
  readonly items: readonly TenantListItem[];
  /**
   * Applications awaiting review, listed above the tenants they may become.
   * Empty when a status filter excludes them.
   */
  readonly pending: readonly PendingTenantApplication[];
  readonly hasFilters: boolean;
  readonly canManage: boolean;
}

export function TenantsTable({
  items,
  pending,
  hasFilters,
  canManage,
}: TenantsTableProps) {
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
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {/* Applications first: they are the rows that need a decision, and a
              queue works from the top. */}
          {pending.map((application) => (
            <TR
              key={application.registrationId}
              className="bg-warning-container/20"
            >
              <TD>
                <Checkbox
                  disabled
                  aria-label={`${application.businessName} is not a tenant yet`}
                />
              </TD>
              <TD>
                <div className="flex items-center gap-3">
                  <Avatar name={application.businessName} size="sm" />
                  <div className="min-w-0">
                    <Link
                      href={ROUTES.bo.registration(application.registrationId)}
                      className="text-foreground hover:text-primary-deep block truncate font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {application.businessName}
                    </Link>
                    <span className="text-muted-foreground tabular block truncate text-xs">
                      {/* No tenant code: one is assigned at provisioning, and
                          inventing it here would show an ID that does not
                          exist. */}
                      {application.registrationCode}
                    </span>
                  </div>
                </div>
              </TD>
              <TD mono className="text-muted-foreground">
                {application.ownerEmail}
              </TD>
              <TD>
                {application.requestedPlanName ? (
                  <Badge shape="tag" tone="neutral">
                    {application.requestedPlanName} requested
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TD>
              <TD>
                <WhatsappIcon status={null} />
              </TD>
              <TD>
                <Badge tone={TENANT_STATUS_TONES.pending} dot>
                  {TENANT_STATUS_LABELS.pending}
                </Badge>
              </TD>
              <TD className="text-right">
                {canManage ? (
                  <PendingApplicationActions
                    registrationId={application.registrationId}
                    businessName={application.businessName}
                    checksPassed={application.checksPassed}
                    checksTotal={application.checksTotal}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Awaiting review
                  </span>
                )}
              </TD>
            </TR>
          ))}

          {items.length === 0 && pending.length === 0 ? (
            <TableEmpty
              colSpan={COLUMN_COUNT}
              title={
                hasFilters ? "No tenants match these filters" : "No tenants yet"
              }
              description={
                hasFilters
                  ? "Try widening the search or clearing one of the filters."
                  : "Sign-ups from the public site land here for approval, and become tenants once approved."
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
                      <span className="text-muted-foreground tabular block truncate text-xs">
                        {tenant.tenantCode}
                        {/* Null for a tenant created directly rather than from
                            an application (§2.5 / D-02). */}
                        {tenant.registrationCode ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="sr-only">from registration </span>
                            {tenant.registrationCode}
                          </>
                        ) : null}
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
                  <Badge
                    tone={TENANT_STATUS_TONES[tenantDisplayStatus(tenant)]}
                  >
                    {TENANT_STATUS_LABELS[tenantDisplayStatus(tenant)]}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <TenantRowActions
                    tenantId={tenant.id}
                    businessName={tenant.businessName}
                    approvalStatus={tenant.approvalStatus}
                    status={tenant.status}
                    websiteUrl={tenant.websiteUrl}
                    canManage={canManage}
                  />
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
