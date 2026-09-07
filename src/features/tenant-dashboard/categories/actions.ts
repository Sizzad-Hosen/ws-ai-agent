"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import { categoryInputSchema } from "./schemas";
import {
  createCategory,
  deleteCategory,
  setCategoryActive,
  updateCategory,
} from "./service";

/**
 * Category mutations.
 *
 * Every one re-runs the full guard rather than trusting an id from the form.
 * The slug decides which database is opened, so an id belonging to another
 * tenant is not a row this connection can reach — it does not need to be
 * checked against an owner column, because there is no shared table.
 */

export interface CategoryActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

const idSchema = z.uuid("Unknown category.");

export async function saveCategoryAction(
  slug: unknown,
  categoryId: unknown,
  input: unknown,
): Promise<CategoryActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = categoryInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Absent id creates; present id updates. Anything else is a malformed call.
  const isUpdate = categoryId !== null && categoryId !== undefined;
  const parsedId = isUpdate ? idSchema.safeParse(categoryId) : null;

  if (parsedId && !parsedId.success) {
    return { success: false, message: "Unknown category." };
  }

  const outcome = parsedId
    ? await updateCategory(tenant.db, parsedId.data, parsed.data)
    : await createCategory(tenant.db, parsed.data);

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

  revalidatePath(tenantHref(parsedSlug.data, "categories"));

  return {
    success: true,
    message: parsedId ? "Category updated." : "Category created.",
  };
}

export async function deleteCategoryAction(
  slug: unknown,
  categoryId: unknown,
): Promise<CategoryActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(categoryId);

  if (!parsedSlug.success || !parsedId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteCategory(tenant.db, parsedId.data);

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "has-products"
          ? "This category still has products. Move them first, or deactivate it instead."
          : "That category no longer exists.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "categories"));

  return { success: true, message: "Category deleted." };
}

export async function setCategoryActiveAction(
  slug: unknown,
  categoryId: unknown,
  isActive: unknown,
): Promise<CategoryActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(categoryId);
  const parsedActive = z.boolean().safeParse(isActive);

  if (!parsedSlug.success || !parsedId.success || !parsedActive.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await setCategoryActive(
    tenant.db,
    parsedId.data,
    parsedActive.data,
  );

  if (!outcome.ok) {
    return { success: false, message: "That category no longer exists." };
  }

  revalidatePath(tenantHref(parsedSlug.data, "categories"));

  return {
    success: true,
    message: parsedActive.data
      ? "Category activated."
      : "Category deactivated.",
  };
}

function writeFailureMessage(
  reason: "duplicate-slug" | "not-found" | "cycle",
): string {
  switch (reason) {
    case "duplicate-slug":
      return "Another category already uses that slug.";
    case "cycle":
      return "A category cannot sit inside itself or one of its own children.";
    default:
      return "That category no longer exists.";
  }
}
