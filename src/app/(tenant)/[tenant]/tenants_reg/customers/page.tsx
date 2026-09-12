import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { TBody, TD, TH, TR, TableEmpty } from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { TenantListCard } from "@/features/tenant-workspace/components/tenant-list-card";
import { listCustomers } from "@/features/tenant-workspace/list-service";
import { parseListParams } from "@/features/tenant-workspace/pagination";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatNumber } from "@/utils/format";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default async function TenantCustomersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/customers">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const listParams = parseListParams(await searchParams);
  const page = await listCustomers(tenant.db, listParams);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Customers"
      description={`People who have bought from ${tenant.businessName}.`}
    >
      <TenantListCard
        basePath={tenantHref(tenant.slug, "customers")}
        search={listParams.search}
        searchInputId="customers-search"
        searchLabel="Search customers by name, email or phone"
        searchPlaceholder="Search by name, email or phone…"
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        noun="customers"
        head={
          <TR className="hover:bg-table-header">
            <TH>Name</TH>
            <TH>Contact</TH>
            <TH>Status</TH>
            <TH numeric>Orders</TH>
            <TH numeric>Added</TH>
          </TR>
        }
      >
        <TBody>
          {page.items.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title={
                listParams.search
                  ? "No customers match this search"
                  : "No customers yet"
              }
              description={
                listParams.search
                  ? "Try a different name, email address or phone number."
                  : "Customers appear here after their first order or conversation."
              }
            />
          ) : (
            page.items.map((row) => (
              <TR key={row.id}>
                <TD className="font-medium">{row.name}</TD>
                <TD>
                  {row.email ? (
                    <span className="block text-[13px]">{row.email}</span>
                  ) : null}
                  {row.phone ? (
                    <span className="text-muted-foreground block font-mono text-xs">
                      {row.phone}
                    </span>
                  ) : null}
                  {!row.email && !row.phone ? (
                    <span className="text-muted-foreground">—</span>
                  ) : null}
                </TD>
                <TD>
                  <Badge tone={CUSTOMER_STATUS_TONES[row.status]}>
                    {CUSTOMER_STATUS_LABELS[row.status]}
                  </Badge>
                </TD>
                <TD numeric>
                  {row.orders === 0 ? (
                    <span className="text-muted-foreground">0</span>
                  ) : (
                    formatNumber(row.orders)
                  )}
                </TD>
                <TD numeric className="text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </TenantListCard>
    </TenantShell>
  );
}
