import type { Metadata } from "next";

import { Card, CardBody } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { CategoryForm } from "@/features/tenant-catalogue/components/category-form";
import { listCategoryOptions } from "@/features/tenant-workspace/detail-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "New category",
  robots: { index: false, follow: false },
};

export default async function NewCategoryPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/categories/new">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const categories = await listCategoryOptions(tenant.db);
  const listHref = tenantHref(tenant.slug, "categories");

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="New category"
      description="Group products so the AI agent can recommend within them."
    >
      <Card>
        <CardBody>
          <CategoryForm
            slug={tenant.slug}
            category={null}
            parentOptions={categories}
            cancelHref={listHref}
            listHref={listHref}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
