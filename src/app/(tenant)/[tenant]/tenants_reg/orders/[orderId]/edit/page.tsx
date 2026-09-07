import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { listCustomerOptions } from "@/features/tenant-dashboard/customers/service";
import { loadStoreCurrency } from "@/features/storefront-assistant/settings";
import { OrderForm } from "@/features/tenant-dashboard/orders/components/order-form";
import { findOrder } from "@/features/tenant-dashboard/orders/service";
import { listVariantOptions } from "@/features/tenant-dashboard/products/service";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Edit order",
  robots: { index: false, follow: false },
};

export default async function EditOrderPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/orders/[orderId]/edit">) {
  const { tenant: slug, orderId } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const order = await findOrder(tenant.db, orderId);

  if (!order) notFound();

  // The pickers are told what this order already holds, so a line against an
  // archived variant, or an order against a blocked customer, still shows the
  // value it has instead of quietly falling back to blank.
  const [customers, variants, currency] = await Promise.all([
    listCustomerOptions(tenant.db, order.customerId ? [order.customerId] : []),
    listVariantOptions(
      tenant.db,
      order.items.map((item) => item.productVariantId),
    ),
    loadStoreCurrency(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title={`Edit ${order.orderNumber}`}
        description="Saving rewrites the lines and recalculates the totals."
        breadcrumbs={[
          { label: "Orders", href: tenantHref(tenant.slug, "orders") },
          {
            label: order.orderNumber,
            href: tenantRecordHref(tenant.slug, "orders", order.id),
          },
          { label: "Edit" },
        ]}
      />

      <OrderForm
        slug={tenant.slug}
        customers={customers}
        variants={variants}
        currency={currency}
        initial={{
          id: order.id,
          customerId: order.customerId,
          shippingAddressId: order.shippingAddressId,
          status: order.status,
          discount: order.discount,
          shippingFee: order.shippingFee,
          tax: order.tax,
          items: order.items.map((item) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
        }}
      />
    </TenantShell>
  );
}
