import { z } from "zod";

import { isValidSlug, MAX_CATEGORY_SLUG, MAX_PRODUCT_SLUG } from "./slug";

/**
 * Validation for the catalogue forms.
 *
 * Every limit here is the column's own limit, not a guess: exceeding one is a
 * database error the form should have caught, and a form that allows more than
 * the column holds is a form that fails on save.
 */

/** Money columns in the tenant schema are Decimal(12,2). */
const MAX_MONEY = 9_999_999_999.99;

/**
 * Prices arrive from a text input and are stored as a decimal string.
 *
 * Kept as a string end to end rather than parsed to a float and re-rendered:
 * `12.10` must not become `12.1`, and a float is the wrong type for money at
 * every step. The regex is what makes the string safe to hand to Postgres.
 */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 249 or 249.50")
  .refine((value) => Number(value) <= MAX_MONEY, {
    message: "That amount is too large.",
  });

const optionalMoney = z
  .union([z.literal(""), moneyString])
  .transform((value) => (value === "" ? null : value));

function slugField(maxLength: number) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => isValidSlug(value, maxLength), {
      message:
        "Use lowercase letters, digits and single hyphens, e.g. blue-shirt.",
    });
}

export const categorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a category name.")
      .max(150, "Name must be 150 characters or fewer."),
    slug: slugField(MAX_CATEGORY_SLUG),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer.")
      .transform((value) => (value === "" ? null : value)),
    // Empty string is the "Top level" option, which is a real choice rather
    // than a missing one.
    parentId: z
      .union([z.literal(""), z.uuid("Choose a parent from the list.")])
      .transform((value) => (value === "" ? null : value)),
    isActive: z.boolean(),
  })
  .strict();

export type CategoryInput = z.infer<typeof categorySchema>;

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a product name.")
      .max(220, "Name must be 220 characters or fewer."),
    slug: slugField(MAX_PRODUCT_SLUG),
    description: z
      .string()
      .trim()
      .max(5000, "Description must be 5000 characters or fewer.")
      .transform((value) => (value === "" ? null : value)),
    categoryId: z
      .union([z.literal(""), z.uuid("Choose a category from the list.")])
      .transform((value) => (value === "" ? null : value)),
    status: z.enum(PRODUCT_STATUSES),
    basePrice: moneyString,
    compareAtPrice: optionalMoney,
  })
  .strict()
  .refine(
    (value) =>
      value.compareAtPrice === null ||
      Number(value.compareAtPrice) > Number(value.basePrice),
    {
      // A compare-at price at or below the selling price shows the customer a
      // discount that is zero or negative.
      message: "The compare-at price must be higher than the price.",
      path: ["compareAtPrice"],
    },
  );

export type ProductInput = z.infer<typeof productSchema>;

export const variantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Enter a SKU.")
      .max(100, "SKU must be 100 characters or fewer.")
      .regex(
        /^[A-Z0-9][A-Z0-9-_.]*$/,
        "Use letters, digits, hyphens, underscores and dots.",
      ),
    price: moneyString,
    compareAtPrice: optionalMoney,
    isActive: z.boolean(),
    quantity: z
      .number()
      .int("Stock must be a whole number.")
      .min(0, "Stock cannot be negative.")
      .max(1_000_000_000, "That quantity is too large."),
    reorderLevel: z.number().int().min(0).max(1_000_000_000).nullable(),
  })
  .strict();

export type VariantInput = z.infer<typeof variantSchema>;

/**
 * The first variant, captured on the product create form.
 *
 * A product with no variant cannot be ordered — `order_items` references a
 * variant, not a product — so creating one without a variant would produce a
 * catalogue entry nobody can buy. The create form therefore asks for a SKU and
 * an opening stock figure, and everything else about variants is managed on
 * the product afterwards.
 */
export const firstVariantSchema = z
  .object({
    sku: variantSchema.shape.sku,
    quantity: variantSchema.shape.quantity,
  })
  .strict();

export type FirstVariantInput = z.infer<typeof firstVariantSchema>;
