import { z } from "zod";

import {
  moneySchema,
  optionalMoneySchema,
} from "@/features/tenant-dashboard/money";
import { listQuerySchema } from "@/features/tenant-dashboard/query";
import { slugSchema } from "@/features/tenant-dashboard/slug";
import { PRODUCT_STATUSES } from "@/features/tenant-dashboard/status";

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(220),
  slug: slugSchema(220),
  description: z.string().trim().max(5000).optional(),
  /** Null is uncategorised: the column is nullable and the tree is optional. */
  categoryId: z.uuid().nullable().optional(),
  status: z.enum(PRODUCT_STATUSES).default("DRAFT"),
  basePrice: moneySchema,
  compareAtPrice: optionalMoneySchema,
});

export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * Variants carry the sellable price and the stock, so a product with none of
 * them cannot appear on an order. Inventory is edited here too: the tenant
 * schema keeps it in its own table, but there is one row per variant, and
 * asking the owner to visit a second screen to set a quantity buys nothing.
 */
export const variantInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "Enter a SKU.")
    .max(100)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Use letters, numbers, dots, dashes or underscores.",
    ),
  price: moneySchema,
  compareAtPrice: optionalMoneySchema,
  isActive: z.boolean().default(true),
  quantity: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(0)
    .max(1_000_000),
  reorderLevel: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)])
    .nullish()
    .transform((value) =>
      value === "" || value === null || value === undefined
        ? null
        : Number(value),
    ),
});

export type VariantInput = z.infer<typeof variantInputSchema>;

/** Unknown filter values are dropped, so a stale bookmark still lists. */
export const productListQuerySchema = listQuerySchema.extend({
  status: z.enum(PRODUCT_STATUSES).optional().catch(undefined),
  categoryId: z.uuid().optional().catch(undefined),
});

export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
