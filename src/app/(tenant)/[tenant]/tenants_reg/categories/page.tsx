import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TBody, TD, TH, TR, TableEmpty } from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { TenantListCard } from "@/features/tenant-workspace/components/tenant-list-card";
import { listCategories } from "@/features/tenant-workspace/list-service";
import { parseListParams } from "@/features/tenant-workspace/pagination";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = {
  title: "Categories",
  robots: { index: false, follow: false },
};

export default async function TenantCategoriesPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/categories">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const listParams = parseListParams(await searchParams);
  const page = await listCategories(tenant.db, listParams);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Categories"
      description="How the catalogue is grouped. A category may sit under a parent."
      actions={
        <Button asChild>
          <Link href={`${tenantHref(tenant.slug, "categories")}/new`}>
            <Plus className="size-4" aria-hidden="true" />
            New category
          </Link>
        </Button>
      }
    >
      <TenantListCard
        basePath={tenantHref(tenant.slug, "categories")}
        search={listParams.search}
        searchInputId="categories-search"
        searchLabel="Search categories by name"
        searchPlaceholder="Search by category name…"
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        noun="categories"
        head={
          <TR className="hover:bg-table-header">
            <TH>Category</TH>
            <TH>Parent</TH>
            <TH>Visible</TH>
            <TH numeric>Products</TH>
          </TR>
        }
      >
        <TBody>
          {page.items.length === 0 ? (
            <TableEmpty
              colSpan={4}
              title={
                listParams.search
                  ? "No categories match this search"
                  : "No categories yet"
              }
              description={
                listParams.search
                  ? "Try a different category name."
                  : "Products can be sold without a category, but grouping them helps the AI agent recommend."
              }
            />
          ) : (
            page.items.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`${tenantHref(tenant.slug, "categories")}/${row.id}/edit`}
                    className="block font-medium underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="text-muted-foreground block font-mono text-xs">
                    {row.slug}
                  </span>
                </TD>
                <TD className="text-muted-foreground">
                  {row.parentName ?? "Top level"}
                </TD>
                <TD>
                  <Badge tone={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? "Visible" : "Hidden"}
                  </Badge>
                </TD>
                <TD numeric>
                  {row.products === 0 ? (
                    <span className="text-muted-foreground">0</span>
                  ) : (
                    formatNumber(row.products)
                  )}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </TenantListCard>
    </TenantShell>
  );
}
