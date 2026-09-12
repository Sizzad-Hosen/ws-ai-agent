import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { TBody, TD, TH, TR, TableEmpty } from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { TenantListCard } from "@/features/tenant-workspace/components/tenant-list-card";
import { listOrders } from "@/features/tenant-workspace/list-service";
import { parseListParams } from "@/features/tenant-workspace/pagination";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatNumber, formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function TenantOrdersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/orders">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const listParams = parseListParams(await searchParams);
  const page = await listOrders(tenant.db, listParams);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Orders"
      description="Every order placed, newest first."
    >
      <TenantListCard
        basePath={tenantHref(tenant.slug, "orders")}
        search={listParams.search}
        searchInputId="orders-search"
        searchLabel="Search orders by number or customer"
        searchPlaceholder="Search by order number or customer…"
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        noun="orders"
        head={
          <TR className="hover:bg-table-header">
            <TH>Order</TH>
            <TH>Customer</TH>
            <TH>Status</TH>
            <TH numeric>Items</TH>
            <TH numeric>Total</TH>
            <TH numeric>Placed</TH>
          </TR>
        }
      >
        <TBody>
          {page.items.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title={
                listParams.search
                  ? "No orders match this search"
                  : "No orders yet"
              }
              description={
                listParams.search
                  ? "Try a different order number or customer name."
                  : "Orders appear here as customers place them."
              }
            />
          ) : (
            page.items.map((row) => (
              <TR key={row.id}>
                <TD mono className="font-medium">
                  <Link
                    href={`${tenantHref(tenant.slug, "orders")}/${row.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.orderNumber}
                  </Link>
                </TD>
                <TD>
                  {row.customerName ?? (
                    <span className="text-muted-foreground">Guest</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={ORDER_STATUS_TONES[row.status]}>
                    {ORDER_STATUS_LABELS[row.status]}
                  </Badge>
                </TD>
                <TD numeric className="text-muted-foreground">
                  {formatNumber(row.items)}
                </TD>
                <TD numeric>{row.total}</TD>
                <TD numeric className="text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(row.placedAt)}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </TenantListCard>
    </TenantShell>
  );
}
