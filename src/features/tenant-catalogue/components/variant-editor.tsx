"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteVariantAction,
  saveVariantAction,
} from "@/features/tenant-catalogue/actions/product-actions";
import type { VariantDetail } from "@/features/tenant-workspace/detail-service";

interface VariantEditorProps {
  readonly slug: string;
  readonly productId: string;
  readonly variants: readonly VariantDetail[];
}

/**
 * Variants and their stock, edited in place.
 *
 * Each row saves on its own rather than the whole table submitting together:
 * correcting one stock figure should not risk overwriting a colleague's change
 * to a different row in the same second.
 */
export function VariantEditor({
  slug,
  productId,
  variants,
}: VariantEditorProps) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {variants.map((variant) => (
        <VariantRow
          key={variant.id}
          slug={slug}
          productId={productId}
          variant={variant}
          canDelete={variants.length > 1 && variant.orderedCount === 0}
        />
      ))}

      {adding ? (
        <VariantRow
          slug={slug}
          productId={productId}
          variant={null}
          canDelete={false}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a variant
        </Button>
      )}
    </div>
  );
}

function VariantRow({
  slug,
  productId,
  variant,
  canDelete,
  onDone,
}: {
  readonly slug: string;
  readonly productId: string;
  readonly variant: VariantDetail | null;
  readonly canDelete: boolean;
  readonly onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  const creating = variant === null;
  const idPrefix = variant?.id ?? "new";

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setFieldErrors({});

    const reorder = String(form.get("reorderLevel") ?? "").trim();

    startTransition(async () => {
      const result = await saveVariantAction(
        slug,
        productId,
        variant?.id ?? null,
        {
          sku: String(form.get("sku") ?? ""),
          price: String(form.get("price") ?? ""),
          compareAtPrice: String(form.get("compareAtPrice") ?? ""),
          isActive: form.get("isActive") !== null,
          quantity: Number(form.get("quantity") ?? 0),
          reorderLevel: reorder === "" ? null : Number(reorder),
        },
      );

      setMessage(result.message);
      setFailed(!result.success);
      setFieldErrors(result.fieldErrors ?? {});

      if (result.success) {
        onDone?.();
        router.refresh();
      }
    });
  }

  function onDelete(): void {
    setMessage(null);

    startTransition(async () => {
      const result = await deleteVariantAction(slug, productId, variant!.id);

      if (result.success) {
        router.refresh();
        return;
      }

      setMessage(result.message);
      setFailed(true);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-border space-y-4 rounded-md border p-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          id={`${idPrefix}-sku`}
          name="sku"
          label="SKU"
          defaultValue={variant?.sku ?? ""}
          error={fieldErrors.sku?.[0]}
          required
        />
        <Field
          id={`${idPrefix}-price`}
          name="price"
          label="Price"
          defaultValue={variant?.price ?? ""}
          error={fieldErrors.price?.[0]}
          inputMode="decimal"
          required
        />
        <Field
          id={`${idPrefix}-compare`}
          name="compareAtPrice"
          label="Compare-at"
          defaultValue={variant?.compareAtPrice ?? ""}
          error={fieldErrors.compareAtPrice?.[0]}
          inputMode="decimal"
          placeholder="Optional"
        />
        <Field
          id={`${idPrefix}-quantity`}
          name="quantity"
          label="Stock"
          defaultValue={String(variant?.quantity ?? 0)}
          error={fieldErrors.quantity?.[0]}
          type="number"
          required
        />
        <Field
          id={`${idPrefix}-reorder`}
          name="reorderLevel"
          label="Reorder at"
          defaultValue={
            variant?.reorderLevel === null ||
            variant?.reorderLevel === undefined
              ? ""
              : String(variant.reorderLevel)
          }
          error={fieldErrors.reorderLevel?.[0]}
          type="number"
          placeholder="Optional"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Switch
          name="isActive"
          label="Available to buy"
          defaultChecked={variant?.isActive ?? true}
        />

        {variant && variant.reservedQuantity ? (
          <Badge tone="info">{variant.reservedQuantity} reserved</Badge>
        ) : null}

        {variant && variant.orderedCount > 0 ? (
          <Badge tone="neutral">
            On {variant.orderedCount} order line
            {variant.orderedCount === 1 ? "" : "s"}
          </Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={onDelete}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          ) : null}

          {creating && onDone ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={onDone}
            >
              Cancel
            </Button>
          ) : null}

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {creating ? "Add variant" : "Save"}
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="text-xs">
        {message ? (
          <span className={failed ? "text-destructive" : "text-success"}>
            {message}
          </span>
        ) : null}
      </p>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  error,
  ...rest
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly error?: string;
  readonly type?: string;
  readonly inputMode?: "decimal";
  readonly placeholder?: string;
  readonly required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={defaultValue} {...rest} />
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
