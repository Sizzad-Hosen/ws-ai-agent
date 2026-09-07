import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
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
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { CustomerAddressesManager } from "@/features/tenant-dashboard/customers/components/customer-addresses-manager";
import { findCustomer } from "@/features/tenant-dashboard/customers/service";
import { TENANT_CURRENCY } from "@/features/tenant-dashboard/money";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatMoney } from "@/utils/format";

export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};

export default async function CustomerPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/customers/[customerId]">) {
  const { tenant: slug, customerId } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const customer = await findCustomer(tenant.db, customerId);

  // A customer id that names nothing in this tenant's database is a 404, the
  // same as an id from another tenant — which is all one connection can see.
  if (!customer) notFound();

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title={customer.name}
        breadcrumbs={[
          { label: "Customers", href: tenantHref(tenant.slug, "customers") },
          { label: customer.name },
        ]}
        meta={
          <Badge tone={CUSTOMER_STATUS_TONES[customer.status]}>
            {CUSTOMER_STATUS_LABELS[customer.status]}
          </Badge>
        }
      />

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Email">{customer.email ?? "—"}</Field>
          <Field label="Phone">{customer.phone ?? "—"}</Field>
          <Field label="Orders">{customer.orderCount}</Field>
          <Field label="Customer since">{formatDate(customer.createdAt)}</Field>
        </CardBody>
      </Card>

      <CustomerAddressesManager
        slug={tenant.slug}
        customerId={customer.id}
        addresses={customer.addresses}
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Order history"
          description="The ten most recent orders from this customer."
        />

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Order</TH>
                <TH>Placed</TH>
                <TH numeric>Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {customer.orders.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="No orders yet"
                  description="Orders placed for this customer will appear here."
                />
              ) : (
                customer.orders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link
                        href={tenantRecordHref(tenant.slug, "orders", order.id)}
                        className="text-foreground font-medium hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">
                      {formatDate(order.placedAt)}
                    </TD>
                    <TD numeric>
                      {formatMoney(order.total, TENANT_CURRENCY) ?? order.total}
                    </TD>
                    <TD>
                      <Badge tone={ORDER_STATUS_TONES[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>
      </Card>
    </TenantShell>
  );
}
