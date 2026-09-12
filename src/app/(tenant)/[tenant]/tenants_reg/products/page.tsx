import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TBody, TD, TH, TR, TableEmpty } from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { TenantListCard } from "@/features/tenant-workspace/components/tenant-list-card";
import { listProducts } from "@/features/tenant-workspace/list-service";
import { parseListParams } from "@/features/tenant-workspace/pagination";
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

export default async function TenantProductsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/products">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const listParams = parseListParams(await searchParams);
  const page = await listProducts(tenant.db, listParams);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Products"
      description="The catalogue the AI agent sells from."
      actions={
        <Button asChild>
          <Link href={`${tenantHref(tenant.slug, "products")}/new`}>
            <Plus className="size-4" aria-hidden="true" />
            New product
          </Link>
        </Button>
      }
    >
      <TenantListCard
        basePath={tenantHref(tenant.slug, "products")}
        search={listParams.search}
        searchInputId="products-search"
        searchLabel="Search products by name"
        searchPlaceholder="Search by product name…"
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        noun="products"
        head={
          <TR className="hover:bg-table-header">
            <TH>Product</TH>
            <TH>Category</TH>
            <TH>Status</TH>
            <TH numeric>Base price</TH>
            <TH numeric>Variants</TH>
            <TH numeric>Stock</TH>
          </TR>
        }
      >
        <TBody>
          {page.items.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title={
                listParams.search
                  ? "No products match this search"
                  : "No products yet"
              }
              description={
                listParams.search
                  ? "Try a different product name."
                  : "The AI agent cannot sell anything until the catalogue has products."
              }
            />
          ) : (
            page.items.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`${tenantHref(tenant.slug, "products")}/${row.id}`}
                    className="block font-medium underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.sku ? (
                    <span className="text-muted-foreground block font-mono text-xs">
                      {row.sku}
                    </span>
                  ) : null}
                </TD>
                <TD className="text-muted-foreground">
                  {row.categoryName ?? "Uncategorised"}
                </TD>
                <TD>
                  <Badge tone={PRODUCT_STATUS_TONES[row.status]}>
                    {PRODUCT_STATUS_LABELS[row.status]}
                  </Badge>
                </TD>
                <TD numeric>{row.basePrice}</TD>
                <TD numeric className="text-muted-foreground">
                  {formatNumber(row.variants)}
                </TD>
                <TD numeric>
                  {row.stock === null ? (
                    <span
                      className="text-muted-foreground"
                      title="No variant of this product tracks inventory."
                    >
                      Not tracked
                    </span>
                  ) : (
                    <span
                      className={
                        row.stock === 0 ? "text-destructive" : undefined
                      }
                    >
                      {formatNumber(row.stock)}
                    </span>
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
