"use server";

import { revalidatePath } from "next/cache";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import {
  firstVariantSchema,
  productSchema,
  variantSchema,
} from "@/features/tenant-catalogue/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import type { CatalogueResult } from "./category-actions";

export type { CatalogueResult };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Prisma reports a blocked delete — a row still referenced — as P2003. */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

/**
 * Creates a product together with its first variant.
 *
 * The two are written in one transaction because a product with no variant
 * cannot be ordered at all — `order_items` references a variant, not a
 * product — so a product created alone is a catalogue entry nobody can buy.
 * Committing the pair or neither is the only correct outcome.
 */
export async function createProductAction(
  slug: unknown,
  input: unknown,
  variantInput: unknown,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);

  const parsed = productSchema.safeParse(input);
  const parsedVariant = firstVariantSchema.safeParse(variantInput);

  if (!parsed.success || !parsedVariant.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        ...(parsed.success ? {} : parsed.error.flatten().fieldErrors),
        ...(parsedVariant.success
          ? {}
          : parsedVariant.error.flatten().fieldErrors),
      },
    };
  }

  try {
    const product = await tenant.db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: parsed.data,
        select: { id: true },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: created.id,
          sku: parsedVariant.data.sku,
          price: parsed.data.basePrice,
          compareAtPrice: parsed.data.compareAtPrice,
          isActive: true,
        },
        select: { id: true },
      });

      await tx.inventory.create({
        data: {
          productVariantId: variant.id,
          quantity: parsedVariant.data.quantity,
        },
      });

      return created;
    });

    revalidatePath(tenantHref(parsedSlug.data, "products"));

    return { success: true, message: "Product created.", id: product.id };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        message: "That web address or SKU is already in use.",
        fieldErrors: {
          slug: ["It may already be taken."],
          sku: ["It may already be taken."],
        },
      };
    }

    console.error("Unable to create the product.", error);
    return {
      success: false,
      message: "The product could not be created. Please try again.",
    };
  }
}

export async function updateProductAction(
  slug: unknown,
  productId: string,
  input: unknown,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = productSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await tenant.db.product.update({
      where: { id: productId },
      data: parsed.data,
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        message: "That web address is already used by another product.",
        fieldErrors: { slug: ["Choose a different one."] },
      };
    }

    console.error("Unable to save the product.", error);
    return {
      success: false,
      message: "The product could not be saved. Please try again.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "products"));
  revalidatePath(`${tenantHref(parsedSlug.data, "products")}/${productId}`);

  return { success: true, message: "Product saved.", id: productId };
}

/**
 * Deletes a product, or explains why it cannot be.
 *
 * `order_items` references a variant with Restrict, so a product that has ever
 * been ordered cannot be removed — and should not be, because deleting it
 * would erase what a past order was for. The answer in that case is to archive
 * it, which hides it from the catalogue and leaves the order history intact,
 * and the message says exactly that rather than reporting a database error.
 */
export async function deleteProductAction(
  slug: unknown,
  productId: string,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);

  const ordered = await tenant.db.orderItem.count({
    where: { variant: { productId } },
  });

  if (ordered > 0) {
    return {
      success: false,
      message: `This product appears on ${ordered} order line${ordered === 1 ? "" : "s"}, so deleting it would erase what those orders were for. Set its status to Archived instead.`,
    };
  }

  try {
    // Variants and their inventory cascade from the product; order items are
    // the only Restrict, and the count above has already ruled them out.
    await tenant.db.product.delete({ where: { id: productId } });
  } catch (error: unknown) {
    if (isForeignKeyViolation(error)) {
      return {
        success: false,
        message:
          "Something still references this product. Set its status to Archived instead.",
      };
    }

    console.error("Unable to delete the product.", error);
    return {
      success: false,
      message: "The product could not be deleted. Please try again.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "products"));

  return { success: true, message: "Product deleted." };
}

/** Creates or updates one variant, with its inventory row. */
export async function saveVariantAction(
  slug: unknown,
  productId: string,
  variantId: string | null,
  input: unknown,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = variantSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { quantity, reorderLevel, ...variantFields } = parsed.data;

  try {
    const id = await tenant.db.$transaction(async (tx) => {
      const variant =
        variantId === null
          ? await tx.productVariant.create({
              data: { productId, ...variantFields },
              select: { id: true },
            })
          : await tx.productVariant.update({
              where: { id: variantId },
              data: variantFields,
              select: { id: true },
            });

      await tx.inventory.upsert({
        where: { productVariantId: variant.id },
        update: { quantity, reorderLevel },
        create: { productVariantId: variant.id, quantity, reorderLevel },
      });

      return variant.id;
    });

    revalidatePath(`${tenantHref(parsedSlug.data, "products")}/${productId}`);
    revalidatePath(tenantHref(parsedSlug.data, "products"));

    return {
      success: true,
      message: variantId === null ? "Variant added." : "Variant saved.",
      id,
    };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        message: "That SKU is already used by another variant.",
        fieldErrors: { sku: ["Choose a different one."] },
      };
    }

    console.error("Unable to save the variant.", error);
    return {
      success: false,
      message: "The variant could not be saved. Please try again.",
    };
  }
}

export async function deleteVariantAction(
  slug: unknown,
  productId: string,
  variantId: string,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);

  const [ordered, remaining] = await Promise.all([
    tenant.db.orderItem.count({ where: { productVariantId: variantId } }),
    tenant.db.productVariant.count({ where: { productId } }),
  ]);

  if (ordered > 0) {
    return {
      success: false,
      message: `This variant appears on ${ordered} order line${ordered === 1 ? "" : "s"} and cannot be deleted. Turn it off instead.`,
    };
  }

  if (remaining <= 1) {
    return {
      success: false,
      message:
        "A product needs at least one variant to be orderable. Add another before removing this one.",
    };
  }

  try {
    await tenant.db.productVariant.delete({ where: { id: variantId } });
  } catch (error: unknown) {
    console.error("Unable to delete the variant.", error);
    return {
      success: false,
      message: "The variant could not be deleted. Please try again.",
    };
  }

  revalidatePath(`${tenantHref(parsedSlug.data, "products")}/${productId}`);
  revalidatePath(tenantHref(parsedSlug.data, "products"));

  return { success: true, message: "Variant deleted." };
}
