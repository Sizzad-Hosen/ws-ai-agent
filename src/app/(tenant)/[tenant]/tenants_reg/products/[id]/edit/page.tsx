import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardBody } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { ProductForm } from "@/features/tenant-catalogue/components/product-form";
import {
  getProduct,
  listCategoryOptions,
} from "@/features/tenant-workspace/detail-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

export default async function EditProductPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/products/[id]/edit">) {
  const { tenant: slug, id } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [product, categories] = await Promise.all([
    getProduct(tenant.db, id),
    listCategoryOptions(tenant.db),
  ]);

  if (!product) notFound();

  const productsHref = tenantHref(tenant.slug, "products");

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={`Edit ${product.name}`}
      description="Prices and stock per variant are on the product page."
    >
      <Card>
        <CardBody>
          <ProductForm
            slug={tenant.slug}
            product={product}
            categoryOptions={categories}
            cancelHref={`${productsHref}/${product.id}`}
            productsHref={productsHref}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
