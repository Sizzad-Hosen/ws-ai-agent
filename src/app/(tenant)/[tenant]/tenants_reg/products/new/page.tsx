import type { Metadata } from "next";

import { Card, CardBody } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { ProductForm } from "@/features/tenant-catalogue/components/product-form";
import { listCategoryOptions } from "@/features/tenant-workspace/detail-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "New product",
  robots: { index: false, follow: false },
};

export default async function NewProductPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/products/new">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const categories = await listCategoryOptions(tenant.db);
  const productsHref = tenantHref(tenant.slug, "products");

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="New product"
      description="Everything the AI agent needs to sell it."
    >
      <Card>
        <CardBody>
          <ProductForm
            slug={tenant.slug}
            product={null}
            categoryOptions={categories}
            cancelHref={productsHref}
            productsHref={productsHref}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
