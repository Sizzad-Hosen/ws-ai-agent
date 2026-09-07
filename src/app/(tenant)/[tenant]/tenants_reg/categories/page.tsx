import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { CategoriesManager } from "@/features/tenant-dashboard/categories/components/categories-manager";
import {
  listCategories,
  listCategoryOptions,
} from "@/features/tenant-dashboard/categories/service";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import {
  listQuerySchema,
  toQueryRecord,
} from "@/features/tenant-dashboard/query";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Categories",
  robots: { index: false, follow: false },
};

export default async function CategoriesPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/categories">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const query = listQuerySchema.parse(toQueryRecord(await searchParams));

  const [result, options] = await Promise.all([
    listCategories(tenant.db, query),
    listCategoryOptions(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="Categories"
        description="Group your products so customers can find them."
      />

      <CategoriesManager
        slug={tenant.slug}
        items={result.items}
        options={options}
        total={result.total}
        limit={result.limit}
        offset={result.offset}
        search={query.search ?? ""}
      />
    </TenantShell>
  );
}
