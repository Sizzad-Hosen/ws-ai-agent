"use client";

import { deleteCategoryAction } from "@/features/tenant-catalogue/actions/category-actions";

import { DeleteRowButton } from "./delete-row-button";

interface DeleteCategoryButtonProps {
  readonly slug: string;
  readonly categoryId: string;
  readonly productCount: number;
  readonly childCount: number;
  readonly listHref: string;
}

/**
 * Deleting a category, with the consequence spelled out first.
 *
 * Neither the products nor the child categories are removed with it — the
 * schema sets both references to null — but "delete" reads as "delete
 * everything under it" to most people, so the confirmation says plainly what
 * actually happens.
 */
export function DeleteCategoryButton({
  slug,
  categoryId,
  productCount,
  childCount,
  listHref,
}: DeleteCategoryButtonProps) {
  const effects: string[] = [];

  if (productCount > 0) {
    effects.push(
      `${productCount} product${productCount === 1 ? "" : "s"} will become uncategorised`,
    );
  }

  if (childCount > 0) {
    effects.push(
      `${childCount} categor${childCount === 1 ? "y" : "ies"} under it will move to the top level`,
    );
  }

  const confirmation =
    effects.length === 0
      ? "Delete this category? Nothing else is affected."
      : `Delete this category? ${effects.join(", and ")}. Nothing is deleted with it.`;

  return (
    <DeleteRowButton
      label="Delete category"
      confirmation={confirmation}
      redirectTo={listHref}
      onDelete={() => deleteCategoryAction(slug, categoryId)}
    />
  );
}
