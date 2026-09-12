import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
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
import { getCustomer } from "@/features/tenant-workspace/detail-service";
import {
  CONVERSATION_STATE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatNumber, formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};

export default async function CustomerDetailPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/customers/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const customer = await getCustomer(tenant.db, id);

  if (!customer) notFound();

  const ordersHref = tenantHref(tenant.slug, "orders");

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={customer.name ?? customer.profileName ?? "Unnamed contact"}
      description={`First seen ${formatDate(customer.firstSeenAt)}, last seen ${formatDate(customer.lastSeenAt)}.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Orders" value={formatNumber(customer.orderCount)} />
        <MetricCard
          label="Lifetime value"
          value={customer.lifetimeValue}
          caption="Delivered, shipped, confirmed and processing"
        />
        <MetricCard
          label="Addresses"
          value={formatNumber(customer.addresses.length)}
        />
        <MetricCard
          label="Conversations"
          value={formatNumber(customer.conversations.length)}
        />
      </div>

      <Card>
        <CardHeader title="Contact details" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            {customer.name ?? (
              <span className="text-muted-foreground">Not given</span>
            )}
          </Field>
          <Field label="WhatsApp id">
            <span className="font-mono text-[13px]">{customer.waId}</span>
          </Field>
          <Field label="Status">
            <Badge tone={CUSTOMER_STATUS_TONES[customer.status]}>
              {CUSTOMER_STATUS_LABELS[customer.status]}
            </Badge>
          </Field>
          <Field label="Phone number">
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="font-mono text-[13px] underline-offset-2 hover:underline"
              >
                {customer.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">Not recorded</span>
            )}
          </Field>
          <Field label="Email">
            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="text-[13px] underline-offset-2 hover:underline"
              >
                {customer.email}
              </a>
            ) : (
              <span className="text-muted-foreground">Not recorded</span>
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Addresses"
          description="Where this customer has asked for deliveries."
        />
        <CardBody>
          {customer.addresses.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No address on file"
              description="An address is recorded the first time this customer places an order."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {customer.addresses.map((address) => (
                <li
                  key={address.id}
                  className="border-border rounded-md border p-4 text-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-medium">
                      {address.label ?? "Address"}
                    </span>
                    {address.isDefault ? (
                      <Badge tone="info">Default</Badge>
                    ) : null}
                  </div>

                  <p className="font-medium">{address.recipientName}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {address.phone}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    {address.addressLine}
                  </p>
                  <p className="text-muted-foreground">
                    {[address.city, address.region].filter(Boolean).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Orders" />
        <CardBody>
          {customer.orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This customer has not ordered yet.
            </p>
          ) : (
            <TableScroller>
              <Table>
                <THead>
                  <TR className="hover:bg-table-header">
                    <TH>Order</TH>
                    <TH>Status</TH>
                    <TH numeric>Total</TH>
                    <TH numeric>Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {customer.orders.map((order) => (
                    <TR key={order.id}>
                      <TD mono className="font-medium">
                        <Link
                          href={`${ordersHref}/${order.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TD>
                      <TD>
                        <Badge tone={ORDER_STATUS_TONES[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TD>
                      <TD numeric>{order.total}</TD>
                      <TD
                        numeric
                        className="text-muted-foreground whitespace-nowrap"
                      >
                        {formatTimestamp(order.placedAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Conversations"
          description="WhatsApp threads with this customer."
        />
        <CardBody>
          {customer.conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversation yet"
              description="A thread appears once this customer messages the business."
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.conversations.map((conversation) => (
                <li
                  key={conversation.id}
                  className="border-border flex flex-wrap items-center gap-3 rounded-md border p-3"
                >
                  <Badge
                    tone={
                      conversation.status === "OPEN" ? "success" : "neutral"
                    }
                  >
                    {conversation.status}
                  </Badge>
                  <span>{CONVERSATION_STATE_LABELS[conversation.state]}</span>
                  {conversation.aiPaused ? (
                    <Badge tone="warning">AI paused</Badge>
                  ) : null}
                  <span className="text-muted-foreground text-xs">
                    {formatNumber(conversation.messages)} message
                    {conversation.messages === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {conversation.lastMessageAt
                      ? formatTimestamp(conversation.lastMessageAt)
                      : "No messages"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </TenantShell>
  );
}
