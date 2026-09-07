import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { loadStoreCurrency } from "@/features/storefront-assistant/settings";
import { findOrder } from "@/features/tenant-dashboard/orders/service";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
} from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatMoney } from "@/utils/format";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/orders/[orderId]">) {
  const { tenant: slug, orderId } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [order, currency] = await Promise.all([
    findOrder(tenant.db, orderId),
    loadStoreCurrency(tenant.db),
  ]);

  // An order id that names nothing in this tenant's database is a 404, the
  // same as an id from another tenant — which is all one connection can see.
  if (!order) notFound();

  const money = (amount: string) => formatMoney(amount, currency) ?? amount;

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDate(order.placedAt)}.`}
        breadcrumbs={[
          { label: "Orders", href: tenantHref(tenant.slug, "orders") },
          { label: order.orderNumber },
        ]}
        meta={
          <Badge tone={ORDER_STATUS_TONES[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        }
        actions={
          <Button variant="secondary" asChild>
            <Link
              href={`${tenantRecordHref(tenant.slug, "orders", order.id)}/edit`}
            >
              Edit order
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lines" />
          <TableScroller>
            <Table>
              <THead>
                <TR className="hover:bg-table-header">
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH numeric>Unit price</TH>
                  <TH numeric>Qty</TH>
                  <TH numeric>Total</TH>
                </TR>
              </THead>
              <TBody>
                {order.items.length === 0 ? (
                  <TableEmpty
                    colSpan={5}
                    title="No lines"
                    description="This order has no lines on it."
                  />
                ) : (
                  order.items.map((item) => (
                    <TR key={item.id}>
                      {/* Names and SKUs are the snapshots taken when the line
                          was written, so a later rename cannot rewrite history. */}
                      <TD>{item.productName}</TD>
                      <TD mono className="text-muted-foreground">
                        {item.sku}
                      </TD>
                      <TD numeric>{money(item.unitPrice)}</TD>
                      <TD numeric>{item.quantity}</TD>
                      <TD numeric>{money(item.total)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroller>

          <CardBody className="pt-4">
            <dl className="ml-auto max-w-xs text-sm">
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular">−{money(order.discount)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular">{money(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular">{money(order.tax)}</dd>
              </div>
              <div className="border-border flex justify-between border-t py-1 font-medium">
                <dt>Total</dt>
                <dd className="tabular">{money(order.total)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Customer and delivery" />
          <CardBody className="space-y-5">
            <Field label="Customer">
              {order.customerId ? (
                <Link
                  href={tenantRecordHref(
                    tenant.slug,
                    "customers",
                    order.customerId,
                  )}
                  className="hover:underline"
                >
                  {order.customerName}
                </Link>
              ) : (
                "Walk-in"
              )}
            </Field>
            <Field label="Email">{order.customerEmail ?? "—"}</Field>
            <Field label="Phone">{order.customerPhone ?? "—"}</Field>
            <Field label="Delivery address">
              {order.shippingAddress ?? "Not set"}
            </Field>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Payments"
          description="Recorded by whatever took the money; read-only here."
        />
        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Provider</TH>
                <TH>Reference</TH>
                <TH numeric>Amount</TH>
                <TH>Paid</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {order.payments.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  title="No payments yet"
                  description="Payments taken against this order will appear here."
                />
              ) : (
                order.payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD>{payment.provider}</TD>
                    <TD mono className="text-muted-foreground">
                      {payment.providerReference ?? "—"}
                    </TD>
                    <TD numeric>
                      {formatMoney(payment.amount, payment.currency) ??
                        payment.amount}
                    </TD>
                    <TD className="text-muted-foreground">
                      {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                    </TD>
                    <TD>
                      <Badge tone={PAYMENT_STATUS_TONES[payment.status]}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
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
