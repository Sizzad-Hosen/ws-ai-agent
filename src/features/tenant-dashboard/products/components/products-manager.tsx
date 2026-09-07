"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { QuerySelect } from "@/components/shared/query-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  TableScroller,
} from "@/components/ui/table";
import {
  deleteProductAction,
  makeProductSellableAction,
  saveProductAction,
} from "@/features/tenant-dashboard/products/actions";
import type { ProductRow } from "@/features/tenant-dashboard/products/service";
import { buildListHref } from "@/features/tenant-dashboard/query";
import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import { slugify } from "@/features/tenant-dashboard/slug";
import {
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONES,
  statusFilterOptions,
} from "@/features/tenant-dashboard/status";
import { formatMoney } from "@/utils/format";

interface ProductsManagerProps {
  readonly slug: string;
  readonly items: readonly ProductRow[];
  readonly categories: readonly { id: string; name: string }[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly search: string;
  readonly status: string;
  readonly categoryId: string;
  readonly currency: string;
}

type Editing =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly row: ProductRow }
  | null;

export function ProductsManager({
  slug,
  items,
  categories,
  total,
  limit,
  offset,
  search,
  status,
  categoryId,
  currency,
}: ProductsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function makeSellable(row: ProductRow): void {
    setRowError(null);

    startTransition(async () => {
      const outcome = await makeProductSellableAction(slug, row.id);

      if (outcome.success) router.refresh();
      else setRowError(outcome.message);
    });
  }

  const base = tenantHref(slug, "products");

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteProductAction(slug, deleting.id);

      if (outcome.success) {
        setDeleting(null);
        router.refresh();
      } else {
        setDeleteError(outcome.message);
      }
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
          {/* Search submits on enter, so it works without JavaScript. The
              filters travel as hidden fields rather than being lost. */}
          <form method="get" action={base} className="flex flex-1 gap-2">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Search products"
              aria-label="Search products"
              className="max-w-xs"
            />
            {status ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            {categoryId ? (
              <input type="hidden" name="categoryId" value={categoryId} />
            ) : null}
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {search || status || categoryId ? (
              <Button variant="ghost" asChild>
                <Link href={base}>Clear</Link>
              </Button>
            ) : null}
          </form>

          <div className="w-40">
            <QuerySelect
              name="status"
              value={status}
              label="Filter by product status"
              options={statusFilterOptions(
                PRODUCT_STATUSES,
                PRODUCT_STATUS_LABELS,
                "Status: All",
              )}
            />
          </div>

          <div className="w-48">
            <QuerySelect
              name="categoryId"
              value={categoryId}
              label="Filter by category"
              options={[
                { value: "", label: "Category: All" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          </div>

          <Button onClick={() => setEditing({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            New product
          </Button>
        </div>

        {rowError ? (
          <p className="text-destructive px-4 pt-3 text-sm" role="alert">
            {rowError}
          </p>
        ) : null}

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Product</TH>
                <TH>Category</TH>
                <TH numeric>Price</TH>
                <TH numeric>Variants</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  title={
                    search || status || categoryId
                      ? "No products match"
                      : "No products yet"
                  }
                  description={
                    search || status || categoryId
                      ? "Try a different search or filter."
                      : "Add what you sell, then give each product its variants and stock."
                  }
                />
              ) : (
                items.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={tenantRecordHref(slug, "products", row.id)}
                        className="text-foreground font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      <span className="text-muted-foreground block truncate text-xs">
                        {row.slug}
                      </span>
                    </TD>
                    <TD>{row.categoryName ?? "—"}</TD>
                    <TD numeric>
                      {formatMoney(row.basePrice, currency) ?? row.basePrice}
                    </TD>
                    <TD numeric>
                      {row.variantCount === 0 ? (
                        <span className="flex items-center justify-end gap-2">
                          <Badge
                            tone="danger"
                            title="No variant, so customers cannot order it"
                          >
                            None
                          </Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            onClick={() => makeSellable(row)}
                          >
                            Make sellable
                          </Button>
                        </span>
                      ) : (
                        row.variantCount
                      )}
                    </TD>
                    <TD>
                      <Badge tone={PRODUCT_STATUS_TONES[row.status]}>
                        {PRODUCT_STATUS_LABELS[row.status]}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={tenantRecordHref(slug, "products", row.id)}
                          >
                            Variants
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ mode: "edit", row })}
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>

        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          buildHref={(next) =>
            buildListHref(base, {
              search: search || undefined,
              status: status || undefined,
              categoryId: categoryId || undefined,
              offset: next,
            })
          }
          noun="products"
        />
      </Card>

      {editing ? (
        <ProductFormDialog
          slug={slug}
          categories={categories}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this product?"
        description={
          <>
            <strong>{deleting?.name}</strong> and its variants will be removed
            permanently. This cannot be undone.
          </>
        }
        confirmLabel="Delete product"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function ProductFormDialog({
  slug,
  categories,
  editing,
  onClose,
  onSaved,
}: {
  readonly slug: string;
  readonly categories: readonly { id: string; name: string }[];
  readonly editing: NonNullable<Editing>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [name, setName] = useState(row?.name ?? "");
  const [slugValue, setSlugValue] = useState(row?.slug ?? "");
  // A slug the user has typed is theirs; before that it tracks the name.
  const [slugTouched, setSlugTouched] = useState(row !== null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slugValue : slugify(name, 220);

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError(null);
    setFieldErrors({});

    const categoryId = String(form.get("categoryId") ?? "");

    startTransition(async () => {
      const outcome = await saveProductAction(slug, row?.id ?? null, {
        name: String(form.get("name") ?? ""),
        slug: effectiveSlug,
        description: String(form.get("description") ?? ""),
        categoryId: categoryId === "" ? null : categoryId,
        status: String(form.get("status") ?? "ACTIVE"),
        basePrice: String(form.get("basePrice") ?? ""),
        compareAtPrice: String(form.get("compareAtPrice") ?? ""),
        // Only meaningful on create: the first variant is made with the
        // product, because nothing can be sold without one. Variants are
        // managed on the product's own page after that.
        openingSku: row ? "" : String(form.get("openingSku") ?? ""),
        openingStock: row ? "" : String(form.get("openingStock") ?? "0"),
      });

      if (outcome.success) {
        onSaved();
      } else {
        setError(outcome.message);
        setFieldErrors(outcome.fieldErrors ?? {});
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={row ? `Edit ${row.name}` : "New product"}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-card border-border max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {row ? "Edit product" : "New product"}
        </h2>

        <div className="mt-5 space-y-4">
          <FormField htmlFor="name" label="Name" error={fieldErrors.name?.[0]}>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="slug" label="Slug" error={fieldErrors.slug?.[0]}>
            <Input
              id="slug"
              name="slug"
              required
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlugValue(event.target.value);
              }}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="categoryId" label="Category">
              <Select
                id="categoryId"
                name="categoryId"
                defaultValue={row?.categoryId ?? ""}
                options={[
                  { value: "", label: "Uncategorised" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </FormField>

            <FormField htmlFor="status" label="Status">
              <Select
                id="status"
                name="status"
                defaultValue={row?.status ?? "ACTIVE"}
                options={PRODUCT_STATUSES.map((value) => ({
                  value,
                  label: PRODUCT_STATUS_LABELS[value],
                }))}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="basePrice"
              label="Price"
              error={fieldErrors.basePrice?.[0]}
            >
              <Input
                id="basePrice"
                name="basePrice"
                required
                inputMode="decimal"
                placeholder="19.99"
                defaultValue={row?.basePrice ?? ""}
              />
            </FormField>

            <FormField
              htmlFor="compareAtPrice"
              label="Compare at (optional)"
              error={fieldErrors.compareAtPrice?.[0]}
            >
              <Input
                id="compareAtPrice"
                name="compareAtPrice"
                inputMode="decimal"
                placeholder="24.99"
                defaultValue={row?.compareAtPrice ?? ""}
              />
            </FormField>
          </div>

          {row ? null : (
            <div className="border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <p className="text-muted-foreground text-xs sm:col-span-2">
                A product is sold through a variant, which holds its SKU and
                stock. The first one is created with the product, priced at the
                price above; add more from the product&apos;s own page.
              </p>

              <FormField
                htmlFor="openingStock"
                label="Opening stock"
                error={fieldErrors.openingStock?.[0]}
              >
                <Input
                  id="openingStock"
                  name="openingStock"
                  inputMode="numeric"
                  defaultValue="0"
                />
              </FormField>

              <FormField
                htmlFor="openingSku"
                label="SKU (optional)"
                error={fieldErrors.openingSku?.[0]}
              >
                <Input
                  id="openingSku"
                  name="openingSku"
                  placeholder="Left blank, we derive it from the slug"
                />
              </FormField>
            </div>
          )}

          <FormField htmlFor="description" label="Description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={row?.description ?? ""}
            />
          </FormField>
        </div>

        {error ? (
          <p className="text-destructive mt-4 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {row ? "Save changes" : "Create product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
