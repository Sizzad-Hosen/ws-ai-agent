"use server";

import { revalidatePath } from "next/cache";

import { tenantHref } from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { categorySchema } from "@/features/tenant-catalogue/schemas";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

export interface CatalogueResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
  /** Present on a successful create, so the caller can navigate to the row. */
  readonly id?: string;
}

/** Postgres reports a unique violation as P2002 through Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Every ancestor of a category, so a cycle can be refused.
 *
 * `categories.parent_id` is self-referencing and Postgres will happily store
 * A → B → A. Nothing would crash; the tree would simply never terminate when
 * walked, which is a bug that surfaces far from where it was created.
 */
async function wouldCycle(
  db: TenantPrismaClient,
  categoryId: string,
  parentId: string,
): Promise<boolean> {
  let current: string | null = parentId;
  // Bounded so a cycle that already exists cannot hang this check.
  let guard = 0;

  while (current !== null && guard < 100) {
    if (current === categoryId) return true;

    const row: { parentId: string | null } | null =
      await db.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });

    current = row?.parentId ?? null;
    guard += 1;
  }

  return false;
}

export async function saveCategoryAction(
  slug: unknown,
  categoryId: string | null,
  input: unknown,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = categorySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  if (categoryId !== null && data.parentId !== null) {
    if (data.parentId === categoryId) {
      return {
        success: false,
        message: "A category cannot be its own parent.",
        fieldErrors: { parentId: ["Choose a different parent."] },
      };
    }

    if (await wouldCycle(tenant.db, categoryId, data.parentId)) {
      return {
        success: false,
        message: "That parent sits underneath this category.",
        fieldErrors: {
          parentId: ["Choosing it would make a loop in the category tree."],
        },
      };
    }
  }

  try {
    const row =
      categoryId === null
        ? await tenant.db.category.create({ data, select: { id: true } })
        : await tenant.db.category.update({
            where: { id: categoryId },
            data,
            select: { id: true },
          });

    revalidatePath(tenantHref(parsedSlug.data, "categories"));
    revalidatePath(tenantHref(parsedSlug.data, "products"));

    return {
      success: true,
      message: categoryId === null ? "Category created." : "Category saved.",
      id: row.id,
    };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        message: "That web address is already used by another category.",
        fieldErrors: { slug: ["Choose a different one."] },
      };
    }

    console.error("Unable to save the category.", error);
    return {
      success: false,
      message: "The category could not be saved. Please try again.",
    };
  }
}

/**
 * Removes a category.
 *
 * Its products are not deleted with it — `products.category_id` is SetNull, so
 * they become uncategorised — and neither are its children, which are promoted
 * to the top level. Both are the schema's own decisions, and the confirmation
 * on the screen says so rather than letting the result surprise anyone.
 */
export async function deleteCategoryAction(
  slug: unknown,
  categoryId: string,
): Promise<CatalogueResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);

  try {
    await tenant.db.category.delete({ where: { id: categoryId } });
  } catch (error: unknown) {
    console.error("Unable to delete the category.", error);
    return {
      success: false,
      message: "The category could not be deleted. Please try again.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "categories"));
  revalidatePath(tenantHref(parsedSlug.data, "products"));

  return { success: true, message: "Category deleted." };
}
