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
  /**
   * Active by default. A shop owner who adds a product means to sell it, and a
   * product that lands in Draft is invisible on the storefront for a reason
   * nobody can see from the screen they added it on.
   */
  status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
  basePrice: moneySchema,
  compareAtPrice: optionalMoneySchema,
  /**
   * The first variant, created with the product.
   *
   * Nothing can be sold without one: the sellable price, the SKU and the stock
   * all live on `product_variants`, and `order_items.product_variant_id` is not
   * nullable — so a product with no variant can be catalogued and never
   * ordered. Asking for a SKU and an opening stock here is what stops an owner
   * filling a catalogue that their storefront cannot show. Ignored on update,
   * where variants are managed on the product's own page.
   */
  openingSku: z
    .string()
    .trim()
    .max(100)
    .regex(
      /^[A-Za-z0-9._-]*$/,
      "Use letters, numbers, dots, dashes or underscores.",
    )
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  openingStock: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)])
    .nullish()
    .transform((value) =>
      value === "" || value === null || value === undefined ? 0 : Number(value),
    ),
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
