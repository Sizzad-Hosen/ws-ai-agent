import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { loadStoreCurrency } from "@/features/storefront-assistant/settings";
import { OrdersManager } from "@/features/tenant-dashboard/orders/components/orders-manager";
import { orderListQuerySchema } from "@/features/tenant-dashboard/orders/schemas";
import { listOrders } from "@/features/tenant-dashboard/orders/service";
import { toQueryRecord } from "@/features/tenant-dashboard/query";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function OrdersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/orders">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const query = orderListQuerySchema.parse(toQueryRecord(await searchParams));
  const [result, currency] = await Promise.all([
    listOrders(tenant.db, query),
    loadStoreCurrency(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="Orders"
        description="What has been ordered, and where each order stands."
      />

      <OrdersManager
        slug={tenant.slug}
        items={result.items}
        total={result.total}
        limit={result.limit}
        offset={result.offset}
        search={query.search ?? ""}
        status={query.status ?? ""}
        currency={currency}
      />
    </TenantShell>
  );
}
