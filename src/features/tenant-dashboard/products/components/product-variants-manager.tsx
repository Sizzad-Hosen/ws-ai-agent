"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  deleteVariantAction,
  saveVariantAction,
} from "@/features/tenant-dashboard/products/actions";
import type { VariantRow } from "@/features/tenant-dashboard/products/service";
import { formatMoney } from "@/utils/format";

interface ProductVariantsManagerProps {
  readonly slug: string;
  readonly productId: string;
  readonly variants: readonly VariantRow[];
  readonly currency: string;
}

type Editing =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly row: VariantRow }
  | null;

/**
 * Variants and their stock, on the product's own page.
 *
 * The sellable price and the SKU live on the variant, not the product, so this
 * is where a product becomes orderable: a product with no variant can be
 * catalogued but never added to an order.
 */
export function ProductVariantsManager({
  slug,
  productId,
  variants,
  currency,
}: ProductVariantsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<VariantRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete(): void {
    if (!deleting) return;
    setDeleteError(null);

    startTransition(async () => {
      const outcome = await deleteVariantAction(slug, productId, deleting.id);

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
        <CardHeader
          title="Variants and stock"
          description="Each variant carries its own SKU, price and quantity."
          actions={
            <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
              <Plus className="size-4" aria-hidden="true" />
              Add variant
            </Button>
          }
        />

        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>SKU</TH>
                <TH numeric>Price</TH>
                <TH numeric>In stock</TH>
                <TH numeric>Reserved</TH>
                <TH numeric>Reorder at</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {variants.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  title="No variants yet"
                  description="A product needs at least one variant before it can be ordered."
                />
              ) : (
                variants.map((row) => (
                  <TR key={row.id}>
                    <TD mono>{row.sku}</TD>
                    <TD numeric>
                      {formatMoney(row.price, currency) ?? row.price}
                    </TD>
                    <TD numeric>
                      {row.quantity === null ? (
                        <span className="text-muted-foreground">
                          Not tracked
                        </span>
                      ) : (
                        row.quantity
                      )}
                    </TD>
                    <TD numeric>{row.reservedQuantity}</TD>
                    <TD numeric>{row.reorderLevel ?? "—"}</TD>
                    <TD>
                      <Badge tone={row.isActive ? "success" : "neutral"}>
                        {row.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing({ mode: "edit", row })}
                          aria-label={`Edit ${row.sku}`}
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
                          aria-label={`Delete ${row.sku}`}
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
      </Card>

      {editing ? (
        <VariantFormDialog
          slug={slug}
          productId={productId}
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
        title="Delete this variant?"
        description={
          <>
            <strong>{deleting?.sku}</strong> and its stock record will be
            removed permanently. This cannot be undone.
          </>
        }
        confirmLabel="Delete variant"
        isPending={isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function VariantFormDialog({
  slug,
  productId,
  editing,
  onClose,
  onSaved,
}: {
  readonly slug: string;
  readonly productId: string;
  readonly editing: NonNullable<Editing>;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const outcome = await saveVariantAction(
        slug,
        productId,
        row?.id ?? null,
        {
          sku: String(form.get("sku") ?? ""),
          price: String(form.get("price") ?? ""),
          compareAtPrice: String(form.get("compareAtPrice") ?? ""),
          isActive,
          quantity: String(form.get("quantity") ?? ""),
          reorderLevel: String(form.get("reorderLevel") ?? ""),
        },
      );

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
      aria-label={row ? `Edit ${row.sku}` : "New variant"}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-card border-border max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {row ? "Edit variant" : "New variant"}
        </h2>

        <div className="mt-5 space-y-4">
          <FormField htmlFor="sku" label="SKU" error={fieldErrors.sku?.[0]}>
            <Input id="sku" name="sku" required defaultValue={row?.sku ?? ""} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="price"
              label="Price"
              error={fieldErrors.price?.[0]}
            >
              <Input
                id="price"
                name="price"
                required
                inputMode="decimal"
                placeholder="19.99"
                defaultValue={row?.price ?? ""}
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
                defaultValue={row?.compareAtPrice ?? ""}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor="quantity"
              label="Quantity in stock"
              error={fieldErrors.quantity?.[0]}
            >
              <Input
                id="quantity"
                name="quantity"
                inputMode="numeric"
                placeholder="Blank = not tracked"
                defaultValue={
                  row?.quantity === null || row?.quantity === undefined
                    ? ""
                    : String(row.quantity)
                }
              />
            </FormField>

            <FormField
              htmlFor="reorderLevel"
              label="Reorder at (optional)"
              error={fieldErrors.reorderLevel?.[0]}
            >
              <Input
                id="reorderLevel"
                name="reorderLevel"
                inputMode="numeric"
                defaultValue={
                  row?.reorderLevel === null || row?.reorderLevel === undefined
                    ? ""
                    : String(row.reorderLevel)
                }
              />
            </FormField>
          </div>

          <span className="flex items-center gap-3 text-sm">
            <Switch
              label="Active"
              defaultChecked={isActive}
              onCheckedChange={setIsActive}
            />
            Active
          </span>
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
            {row ? "Save changes" : "Add variant"}
          </Button>
        </div>
      </form>
    </div>
  );
}
