import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { CategoryForm } from "@/features/tenant-catalogue/components/category-form";
import { DeleteCategoryButton } from "@/features/tenant-catalogue/components/delete-category-button";
import {
  getCategory,
  listCategoryOptions,
} from "@/features/tenant-workspace/detail-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Edit category",
  robots: { index: false, follow: false },
};

export default async function EditCategoryPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/categories/[id]/edit">) {
  const { tenant: slug, id } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [category, categories] = await Promise.all([
    getCategory(tenant.db, id),
    listCategoryOptions(tenant.db),
  ]);

  // Not found rather than an error page: an id from another workspace, or one
  // already deleted, both mean "no such category here".
  if (!category) notFound();

  const listHref = tenantHref(tenant.slug, "categories");

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={category.name}
      description="Edit this category, or remove it."
    >
      <Card>
        <CardBody>
          <CategoryForm
            slug={tenant.slug}
            category={category}
            parentOptions={categories}
            cancelHref={listHref}
            listHref={listHref}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Delete this category"
          description="Its products and any categories under it are kept."
        />
        <CardBody>
          <DeleteCategoryButton
            slug={tenant.slug}
            categoryId={category.id}
            productCount={category.productCount}
            childCount={category.childCount}
            listHref={listHref}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
