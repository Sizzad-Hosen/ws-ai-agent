import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { listCategoryOptions } from "@/features/tenant-dashboard/categories/service";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { loadStoreCurrency } from "@/features/storefront-assistant/settings";
import { ProductsManager } from "@/features/tenant-dashboard/products/components/products-manager";
import { productListQuerySchema } from "@/features/tenant-dashboard/products/schemas";
import { listProducts } from "@/features/tenant-dashboard/products/service";
import { toQueryRecord } from "@/features/tenant-dashboard/query";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/products">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const query = productListQuerySchema.parse(toQueryRecord(await searchParams));

  const [result, categories, currency] = await Promise.all([
    listProducts(tenant.db, query),
    listCategoryOptions(tenant.db),
    loadStoreCurrency(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="Products"
        description="What you sell, and the variants and stock behind each one."
      />

      <ProductsManager
        slug={tenant.slug}
        items={result.items}
        categories={categories}
        total={result.total}
        limit={result.limit}
        offset={result.offset}
        search={query.search ?? ""}
        status={query.status ?? ""}
        categoryId={query.categoryId ?? ""}
        currency={currency}
      />
    </TenantShell>
  );
}
