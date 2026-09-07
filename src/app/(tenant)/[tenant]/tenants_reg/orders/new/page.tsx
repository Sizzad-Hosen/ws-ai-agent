import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { listCustomerOptions } from "@/features/tenant-dashboard/customers/service";
import { TENANT_CURRENCY } from "@/features/tenant-dashboard/money";
import { OrderForm } from "@/features/tenant-dashboard/orders/components/order-form";
import { listVariantOptions } from "@/features/tenant-dashboard/products/service";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "New order",
  robots: { index: false, follow: false },
};

export default async function NewOrderPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/orders/new">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [customers, variants] = await Promise.all([
    listCustomerOptions(tenant.db),
    listVariantOptions(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="New order"
        description="Pick the customer, then the lines. Prices come from the catalogue."
        breadcrumbs={[
          { label: "Orders", href: tenantHref(tenant.slug, "orders") },
          { label: "New order" },
        ]}
      />

      <OrderForm
        slug={tenant.slug}
        customers={customers}
        variants={variants}
        currency={TENANT_CURRENCY}
        initial={{
          id: null,
          customerId: null,
          shippingAddressId: null,
          status: "PENDING",
          discount: "0",
          shippingFee: "0",
          tax: "0",
          items: [],
        }}
      />
    </TenantShell>
  );
}
