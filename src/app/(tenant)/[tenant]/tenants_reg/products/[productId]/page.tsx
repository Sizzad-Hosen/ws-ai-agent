import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { loadStoreCurrency } from "@/features/storefront-assistant/settings";
import { ProductVariantsManager } from "@/features/tenant-dashboard/products/components/product-variants-manager";
import { findProduct } from "@/features/tenant-dashboard/products/service";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
} from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatMoney } from "@/utils/format";

export const metadata: Metadata = {
  title: "Product",
  robots: { index: false, follow: false },
};

export default async function ProductPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/products/[productId]">) {
  const { tenant: slug, productId } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [product, currency] = await Promise.all([
    findProduct(tenant.db, productId),
    loadStoreCurrency(tenant.db),
  ]);

  // A product id that names nothing in this tenant's database is a 404, the
  // same as an id from another tenant — which is all one connection can see.
  if (!product) notFound();

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title={product.name}
        description={product.description ?? undefined}
        breadcrumbs={[
          { label: "Products", href: tenantHref(tenant.slug, "products") },
          { label: product.name },
        ]}
        meta={
          <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </Badge>
        }
      />

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Slug">{product.slug}</Field>
          <Field label="Category">
            {product.categoryName ?? "Uncategorised"}
          </Field>
          <Field label="Base price">
            {formatMoney(product.basePrice, currency) ?? product.basePrice}
          </Field>
          <Field label="Compare at">
            {product.compareAtPrice
              ? formatMoney(product.compareAtPrice, currency)
              : "—"}
          </Field>
          <Field label="Added">{formatDate(product.createdAt)}</Field>
        </CardBody>
      </Card>

      <ProductVariantsManager
        slug={tenant.slug}
        productId={product.id}
        variants={product.variants}
        currency={currency}
      />
    </TenantShell>
  );
}
