import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { DeleteProductButton } from "@/features/tenant-catalogue/components/delete-product-button";
import { VariantEditor } from "@/features/tenant-catalogue/components/variant-editor";
import { getProduct } from "@/features/tenant-workspace/detail-service";
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = {
  title: "Product",
  robots: { index: false, follow: false },
};

export default async function ProductDetailPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/products/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const product = await getProduct(tenant.db, id);

  if (!product) notFound();

  const productsHref = tenantHref(tenant.slug, "products");
  const totalStock = product.variants.reduce(
    (sum, variant) => sum + (variant.quantity ?? 0),
    0,
  );
  const tracked = product.variants.some((variant) => variant.quantity !== null);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={product.name}
      description={product.description ?? "No description yet."}
      actions={
        <Button asChild variant="secondary">
          <Link href={`${productsHref}/${product.id}/edit`}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit product
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Status">
            <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
              {PRODUCT_STATUS_LABELS[product.status]}
            </Badge>
          </Field>
          <Field label="Category">
            {product.categoryName ?? "Uncategorised"}
          </Field>
          <Field label="Price">{product.basePrice}</Field>
          <Field label="Web address">
            <span className="font-mono text-[13px]">{product.slug}</span>
          </Field>
          <Field label="Total stock">
            {tracked ? formatNumber(totalStock) : "Not tracked"}
          </Field>
          <Field label="On order lines">
            {formatNumber(product.orderedCount)}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Variants and stock"
          description="Each variant is what a customer actually buys. Rows save one at a time."
        />
        <CardBody>
          <VariantEditor
            slug={tenant.slug}
            productId={product.id}
            variants={product.variants}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Delete this product" />
        <CardBody>
          <DeleteProductButton
            slug={tenant.slug}
            productId={product.id}
            variantCount={product.variants.length}
            orderedCount={product.orderedCount}
            listHref={productsHref}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
