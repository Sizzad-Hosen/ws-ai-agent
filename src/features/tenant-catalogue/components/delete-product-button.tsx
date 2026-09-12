"use client";

import { deleteProductAction } from "@/features/tenant-catalogue/actions/product-actions";

import { DeleteRowButton } from "./delete-row-button";

interface DeleteProductButtonProps {
  readonly slug: string;
  readonly productId: string;
  readonly variantCount: number;
  readonly orderedCount: number;
  readonly listHref: string;
}

/**
 * Deleting a product.
 *
 * A product that has ever been ordered cannot be deleted at all: `order_items`
 * references its variant with Restrict, and removing it would erase what a
 * past order was for. The button says so up front instead of letting the
 * attempt fail, and points at archiving, which is the answer.
 */
export function DeleteProductButton({
  slug,
  productId,
  variantCount,
  orderedCount,
  listHref,
}: DeleteProductButtonProps) {
  if (orderedCount > 0) {
    return (
      <p className="text-muted-foreground max-w-prose text-sm">
        This product appears on {orderedCount} order line
        {orderedCount === 1 ? "" : "s"}, so it cannot be deleted — removing it
        would erase what those orders were for. Set its status to{" "}
        <strong>Archived</strong> to take it out of the catalogue and keep the
        order history intact.
      </p>
    );
  }

  return (
    <DeleteRowButton
      label="Delete product"
      confirmation={`Delete this product and its ${variantCount} variant${variantCount === 1 ? "" : "s"}? This cannot be undone.`}
      redirectTo={listHref}
      onDelete={() => deleteProductAction(slug, productId)}
    />
  );
}
