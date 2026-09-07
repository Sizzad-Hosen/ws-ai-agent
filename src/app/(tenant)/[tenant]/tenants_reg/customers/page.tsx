import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { CustomersManager } from "@/features/tenant-dashboard/customers/components/customers-manager";
import { customerListQuerySchema } from "@/features/tenant-dashboard/customers/schemas";
import { listCustomers } from "@/features/tenant-dashboard/customers/service";
import { toQueryRecord } from "@/features/tenant-dashboard/query";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default async function CustomersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/customers">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const query = customerListQuerySchema.parse(
    toQueryRecord(await searchParams),
  );
  const result = await listCustomers(tenant.db, query);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="Customers"
        description="The people you sell to, and where their orders go."
      />

      <CustomersManager
        slug={tenant.slug}
        items={result.items}
        total={result.total}
        limit={result.limit}
        offset={result.offset}
        search={query.search ?? ""}
        status={query.status ?? ""}
      />
    </TenantShell>
  );
}
