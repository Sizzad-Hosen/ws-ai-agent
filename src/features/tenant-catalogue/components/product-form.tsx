"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductAction,
  updateProductAction,
} from "@/features/tenant-catalogue/actions/product-actions";
import { PRODUCT_STATUSES } from "@/features/tenant-catalogue/schemas";
import { deriveSlug, MAX_PRODUCT_SLUG } from "@/features/tenant-catalogue/slug";
import { PRODUCT_STATUS_LABELS } from "@/features/tenant-workspace/status";
import type {
  CategoryOption,
  ProductDetail,
} from "@/features/tenant-workspace/detail-service";

interface ProductFormProps {
  readonly slug: string;
  /** Null when creating. */
  readonly product: ProductDetail | null;
  readonly categoryOptions: readonly CategoryOption[];
  readonly cancelHref: string;
  /** Where to go after saving; the new product's page when creating. */
  readonly productsHref: string;
}

export function ProductForm({
  slug,
  product,
  categoryOptions,
  cancelHref,
  productsHref,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [slugValue, setSlugValue] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(product !== null);

  const creating = product === null;

  function onNameChange(name: string): void {
    if (slugTouched) return;
    setSlugValue(deriveSlug(name, MAX_PRODUCT_SLUG) ?? "");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setFieldErrors({});

    const fields = {
      name: String(form.get("name") ?? ""),
      slug: String(form.get("slug") ?? ""),
      description: String(form.get("description") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      status: String(form.get("status") ?? "DRAFT"),
      basePrice: String(form.get("basePrice") ?? ""),
      compareAtPrice: String(form.get("compareAtPrice") ?? ""),
    };

    startTransition(async () => {
      const result = creating
        ? await createProductAction(slug, fields, {
            sku: String(form.get("sku") ?? ""),
            quantity: Number(form.get("quantity") ?? 0),
          })
        : await updateProductAction(slug, product.id, fields);

      if (result.success && result.id) {
        router.push(`${productsHref}/${result.id}`);
        router.refresh();
        return;
      }

      setMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <FormField htmlFor="name" label="Name" error={fieldErrors.name?.[0]}>
        <Input
          id="name"
          name="name"
          defaultValue={product?.name ?? ""}
          maxLength={220}
          onChange={(event) => onNameChange(event.target.value)}
          required
        />
      </FormField>

      <FormField
        htmlFor="slug"
        label="Web address"
        error={fieldErrors.slug?.[0]}
      >
        <Input
          id="slug"
          name="slug"
          value={slugValue}
          maxLength={MAX_PRODUCT_SLUG}
          onChange={(event) => {
            setSlugTouched(true);
            setSlugValue(event.target.value);
          }}
          required
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          htmlFor="categoryId"
          label="Category"
          error={fieldErrors.categoryId?.[0]}
        >
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={product?.categoryId ?? ""}
            options={[
              { value: "", label: "Uncategorised" },
              ...categoryOptions.map((option) => ({
                value: option.id,
                label: option.name,
              })),
            ]}
          />
        </FormField>

        <FormField
          htmlFor="status"
          label="Status"
          error={fieldErrors.status?.[0]}
        >
          <Select
            id="status"
            name="status"
            defaultValue={product?.status ?? "DRAFT"}
            options={PRODUCT_STATUSES.map((value) => ({
              value,
              label: PRODUCT_STATUS_LABELS[value],
            }))}
          />
        </FormField>

        <FormField
          htmlFor="basePrice"
          label="Price"
          error={fieldErrors.basePrice?.[0]}
        >
          <Input
            id="basePrice"
            name="basePrice"
            inputMode="decimal"
            defaultValue={product?.basePrice ?? ""}
            placeholder="249.00"
            required
          />
        </FormField>

        <FormField
          htmlFor="compareAtPrice"
          label="Compare-at price"
          error={fieldErrors.compareAtPrice?.[0]}
        >
          <Input
            id="compareAtPrice"
            name="compareAtPrice"
            inputMode="decimal"
            defaultValue={product?.compareAtPrice ?? ""}
            placeholder="Optional"
          />
          <p className="text-muted-foreground text-xs">
            The struck-through price. Leave empty if it is not on offer.
          </p>
        </FormField>
      </div>

      <FormField
        htmlFor="description"
        label="Description"
        error={fieldErrors.description?.[0]}
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={product?.description ?? ""}
          maxLength={5000}
          rows={5}
        />
      </FormField>

      {creating ? (
        <fieldset className="border-border space-y-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">First variant</legend>
          <p className="text-muted-foreground text-xs">
            A product is bought as a variant, so it needs at least one. Add more
            sizes or colours after it is created.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="sku" label="SKU" error={fieldErrors.sku?.[0]}>
              <Input
                id="sku"
                name="sku"
                maxLength={100}
                placeholder="RICE-BAS-5K"
                required
              />
            </FormField>

            <FormField
              htmlFor="quantity"
              label="Opening stock"
              error={fieldErrors.quantity?.[0]}
            >
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={0}
                step={1}
                defaultValue={0}
                required
              />
            </FormField>
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {creating ? "Create product" : "Save changes"}
        </Button>

        <Button asChild variant="secondary">
          <a href={cancelHref}>Cancel</a>
        </Button>

        <p aria-live="polite" className="text-xs">
          {message ? <span className="text-destructive">{message}</span> : null}
        </p>
      </div>
    </form>
  );
}
