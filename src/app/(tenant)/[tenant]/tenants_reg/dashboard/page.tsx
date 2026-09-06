import type { Metadata } from "next";
import { Activity, ShoppingCart, TrendingUp } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroller,
} from "@/components/ui/table";
import { TenantHeader } from "@/features/tenant-dashboard/components/tenant-header";
import { TenantSidebar } from "@/features/tenant-dashboard/components/tenant-sidebar";
import { loadTenantDashboard } from "@/features/tenant-dashboard/dashboard-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function TenantDashboardPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/dashboard">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);
  const stats = await loadTenantDashboard(tenant.db);

  const peak = Math.max(...stats.salesByDay.map((point) => point.total), 1);

  return (
    <div className="flex min-h-screen">
      <TenantSidebar slug={tenant.slug} businessName={tenant.businessName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TenantHeader
          slug={tenant.slug}
          businessName={tenant.businessName}
          user={user}
        />

        <main className="flex-1 space-y-6 p-4 sm:p-6">
          <PageHeader
            title="Dashboard"
            description={`An overview of ${tenant.businessName}.`}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Customers"
              value={String(stats.totalCustomers)}
            />
            <MetricCard label="Users" value={String(stats.totalUsers)} />
            <MetricCard label="Products" value={String(stats.totalProducts)} />
            <MetricCard label="Orders" value={String(stats.totalOrders)} />
            <MetricCard
              label="Revenue"
              value={`${stats.currency} ${Number(stats.revenue).toFixed(2)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Sales overview" />
              <CardBody>
                {stats.salesByDay.every((point) => point.total === 0) ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No sales yet"
                    description="Orders placed in the last two weeks appear here."
                  />
                ) : (
                  <div
                    className="flex h-40 items-end gap-1"
                    role="img"
                    aria-label={`Daily order totals for the last ${stats.salesByDay.length} days`}
                  >
                    {stats.salesByDay.map((point) => (
                      <div
                        key={point.day}
                        className="bg-primary/80 min-h-[2px] flex-1 rounded-t"
                        style={{
                          height: `${Math.round((point.total / peak) * 100)}%`,
                        }}
                        title={`${point.day}: ${stats.currency} ${point.total.toFixed(2)}`}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent activity" />
              <CardBody>
                {stats.recentActivity.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="Nothing yet"
                    description="Customers, products and orders show up here as they arrive."
                  />
                ) : (
                  <ul className="space-y-3">
                    {stats.recentActivity.map((entry) => (
                      <li key={entry.id} className="text-sm">
                        <p className="text-foreground">{entry.description}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(entry.at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Recent orders" />
            <TableScroller>
              <Table>
                <THead>
                  <TR className="hover:bg-table-header">
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                    <TH>Total</TH>
                    <TH>Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {stats.recentOrders.length === 0 ? (
                    <TR>
                      <TD colSpan={5}>
                        <EmptyState
                          icon={ShoppingCart}
                          title="No orders yet"
                          description="Orders placed through WhatsApp appear here."
                        />
                      </TD>
                    </TR>
                  ) : (
                    stats.recentOrders.map((order) => (
                      <TR key={order.id}>
                        <TD mono>{order.orderNumber}</TD>
                        <TD>{order.customerName ?? "—"}</TD>
                        <TD>
                          <Badge tone="neutral">{order.status}</Badge>
                        </TD>
                        <TD className="tabular">
                          {stats.currency} {Number(order.total).toFixed(2)}
                        </TD>
                        <TD className="text-muted-foreground">
                          {formatDate(order.placedAt)}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableScroller>
          </Card>
        </main>
      </div>
    </div>
  );
}
