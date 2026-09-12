import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
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
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { getOrder } from "@/features/tenant-workspace/detail-service";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatNumber, formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/orders/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const order = await getOrder(tenant.db, id);

  if (!order) notFound();

  const customersHref = tenantHref(tenant.slug, "customers");
  const productsHref = tenantHref(tenant.slug, "products");
  const address = order.shippingAddress;

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={order.orderNumber}
      description={`Placed ${formatTimestamp(order.placedAt)}.`}
      actions={
        <Badge tone={ORDER_STATUS_TONES[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              {order.customerId && order.customerName ? (
                <Link
                  href={`${customersHref}/${order.customerId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {order.customerName}
                </Link>
              ) : (
                <span className="text-muted-foreground">Guest</span>
              )}
            </Field>
            <Field label="Phone number">
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="font-mono text-[13px] underline-offset-2 hover:underline"
                >
                  {order.customerPhone}
                </a>
              ) : (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </Field>
            <Field label="Email">
              {order.customerEmail ? (
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-[13px] underline-offset-2 hover:underline"
                >
                  {order.customerEmail}
                </a>
              ) : (
                <span className="text-muted-foreground">Not recorded</span>
              )}
            </Field>
            <Field label="Last changed">
              {formatTimestamp(order.updatedAt)}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Delivery address" />
          <CardBody>
            {address === null ? (
              <p className="text-muted-foreground text-sm">
                No address was recorded on this order.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{address.recipientName}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {address.phone}
                </p>
                <p className="text-muted-foreground pt-2">
                  {address.addressLine}
                </p>
                <p className="text-muted-foreground">
                  {[address.city, address.region, address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Items"
          description="Names and SKUs are as they were when the order was placed."
        />
        <CardBody>
          <TableScroller>
            <Table>
              <THead>
                <TR className="hover:bg-table-header">
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH numeric>Unit price</TH>
                  <TH numeric>Quantity</TH>
                  <TH numeric>Line total</TH>
                </TR>
              </THead>
              <TBody>
                {order.items.map((item) => (
                  <TR key={item.id}>
                    <TD className="font-medium">
                      {item.productId ? (
                        <Link
                          href={`${productsHref}/${item.productId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        item.productName
                      )}
                    </TD>
                    <TD mono className="text-muted-foreground">
                      {item.sku}
                    </TD>
                    <TD numeric>{item.unitPrice}</TD>
                    <TD numeric>{formatNumber(item.quantity)}</TD>
                    <TD numeric>{item.total}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroller>

          <dl className="border-border mt-4 ml-auto max-w-xs space-y-2 border-t pt-4 text-sm">
            <Total label="Subtotal" value={order.subtotal} />
            {Number(order.discount) > 0 ? (
              <Total label="Discount" value={`−${order.discount}`} />
            ) : null}
            <Total label="Delivery" value={order.shippingFee} />
            {Number(order.tax) > 0 ? (
              <Total label="Tax" value={order.tax} />
            ) : null}
            <div className="border-border flex justify-between border-t pt-2 font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{order.total}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payments" />
        <CardBody>
          {order.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No payment has been recorded against this order.
            </p>
          ) : (
            <TableScroller>
              <Table>
                <THead>
                  <TR className="hover:bg-table-header">
                    <TH>Provider</TH>
                    <TH>Reference</TH>
                    <TH>Status</TH>
                    <TH numeric>Amount</TH>
                    <TH numeric>Paid</TH>
                  </TR>
                </THead>
                <TBody>
                  {order.payments.map((payment) => (
                    <TR key={payment.id}>
                      <TD className="font-medium">{payment.provider}</TD>
                      <TD mono className="text-muted-foreground">
                        {payment.providerReference ?? "—"}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            payment.status === "PAID"
                              ? "success"
                              : payment.status === "FAILED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TD>
                      <TD numeric>
                        {payment.currency} {payment.amount}
                      </TD>
                      <TD
                        numeric
                        className="text-muted-foreground whitespace-nowrap"
                      >
                        {payment.paidAt ? formatTimestamp(payment.paidAt) : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          )}
        </CardBody>
      </Card>
    </TenantShell>
  );
}

function Total({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="text-muted-foreground flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
