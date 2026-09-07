"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { PRODUCT_STATUSES } from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import { productInputSchema, variantInputSchema } from "./schemas";
import {
  addDefaultVariant,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  setProductStatus,
  updateProduct,
  updateVariant,
} from "./service";

/**
 * Catalogue mutations.
 *
 * Every one re-runs the full guard rather than trusting an id from the form.
 * The slug decides which database is opened, so an id belonging to another
 * tenant is not a row this connection can reach — it does not need to be
 * checked against an owner column, because there is no shared table.
 */

export interface ProductActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
  /** Set on a create, so the caller can navigate to the new row. */
  readonly id?: string;
}

const idSchema = z.uuid("Unknown product.");

export async function saveProductAction(
  slug: unknown,
  productId: unknown,
  input: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = productInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Absent id creates; present id updates. Anything else is a malformed call.
  const isUpdate = productId !== null && productId !== undefined;
  const parsedId = isUpdate ? idSchema.safeParse(productId) : null;

  if (parsedId && !parsedId.success) {
    return { success: false, message: "Unknown product." };
  }

  const outcome = parsedId
    ? await updateProduct(tenant.db, parsedId.data, parsed.data)
    : await createProduct(tenant.db, parsed.data);

  if (!outcome.ok) {
    return {
      success: false,
      message: writeFailureMessage(outcome.reason),
      fieldErrors:
        outcome.reason === "duplicate-slug"
          ? { slug: ["That slug is already in use."] }
          : undefined,
    };
  }

  revalidateProduct(parsedSlug.data, outcome.id);

  return {
    success: true,
    message: parsedId ? "Product updated." : "Product created.",
    id: outcome.id,
  };
}

/**
 * Gives a product the first variant it never got.
 *
 * For rows that predate variants being created with the product, and for
 * anything written straight into the tables. Priced from `basePrice`, which is
 * what a product created today would use — so a catalogue that was invisible
 * to customers becomes sellable without retyping it.
 */
export async function makeProductSellableAction(
  slug: unknown,
  productId: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(productId);

  if (!parsedSlug.success || !parsedId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await addDefaultVariant(tenant.db, parsedId.data);

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "not-found"
          ? "That product no longer exists."
          : "This product already has a variant. Open it to edit the stock.",
    };
  }

  revalidateProduct(parsedSlug.data, parsedId.data);

  return {
    success: true,
    message: "Variant added. Set its stock so customers can order it.",
    id: outcome.id,
  };
}

export async function deleteProductAction(
  slug: unknown,
  productId: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(productId);

  if (!parsedSlug.success || !parsedId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteProduct(tenant.db, parsedId.data);

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "has-orders"
          ? "This product has been ordered, so its history has to stay. Archive it instead."
          : "That product no longer exists.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "products"));

  return { success: true, message: "Product deleted." };
}

export async function setProductStatusAction(
  slug: unknown,
  productId: unknown,
  status: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(productId);
  const parsedStatus = z.enum(PRODUCT_STATUSES).safeParse(status);

  if (!parsedSlug.success || !parsedId.success || !parsedStatus.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await setProductStatus(
    tenant.db,
    parsedId.data,
    parsedStatus.data,
  );

  if (!outcome.ok) {
    return { success: false, message: "That product no longer exists." };
  }

  revalidateProduct(parsedSlug.data, parsedId.data);

  return { success: true, message: "Product status updated." };
}

export async function saveVariantAction(
  slug: unknown,
  productId: unknown,
  variantId: unknown,
  input: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedProductId = idSchema.safeParse(productId);

  if (!parsedSlug.success || !parsedProductId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = variantInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const isUpdate = variantId !== null && variantId !== undefined;
  const parsedVariantId = isUpdate ? idSchema.safeParse(variantId) : null;

  if (parsedVariantId && !parsedVariantId.success) {
    return { success: false, message: "Unknown variant." };
  }

  const outcome = parsedVariantId
    ? await updateVariant(
        tenant.db,
        parsedProductId.data,
        parsedVariantId.data,
        parsed.data,
      )
    : await createVariant(tenant.db, parsedProductId.data, parsed.data);

  if (!outcome.ok) {
    return {
      success: false,
      message: writeFailureMessage(outcome.reason),
      fieldErrors:
        outcome.reason === "duplicate-sku"
          ? { sku: ["Another variant already uses that SKU."] }
          : undefined,
    };
  }

  revalidateProduct(parsedSlug.data, parsedProductId.data);

  return {
    success: true,
    message: parsedVariantId ? "Variant updated." : "Variant added.",
    id: outcome.id,
  };
}

export async function deleteVariantAction(
  slug: unknown,
  productId: unknown,
  variantId: unknown,
): Promise<ProductActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedProductId = idSchema.safeParse(productId);
  const parsedVariantId = idSchema.safeParse(variantId);

  if (
    !parsedSlug.success ||
    !parsedProductId.success ||
    !parsedVariantId.success
  ) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteVariant(
    tenant.db,
    parsedProductId.data,
    parsedVariantId.data,
  );

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "has-orders"
          ? "This variant appears on an order, so it has to stay. Deactivate it instead."
          : "That variant no longer exists.",
    };
  }

  revalidateProduct(parsedSlug.data, parsedProductId.data);

  return { success: true, message: "Variant removed." };
}

/** The list and the product's own page both show what a write changed. */
function revalidateProduct(slug: string, productId: string): void {
  revalidatePath(tenantHref(slug, "products"));
  revalidatePath(tenantRecordHref(slug, "products", productId));
}

function writeFailureMessage(
  reason: "duplicate-slug" | "duplicate-sku" | "not-found",
): string {
  switch (reason) {
    case "duplicate-slug":
      return "Another product already uses that slug.";
    case "duplicate-sku":
      return "Another variant already uses that SKU.";
    default:
      return "That product no longer exists.";
  }
}
