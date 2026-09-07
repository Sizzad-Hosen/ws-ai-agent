import { z } from "zod";

import { moneySchema } from "@/features/tenant-dashboard/money";
import { listQuerySchema } from "@/features/tenant-dashboard/query";
import { ORDER_STATUSES } from "@/features/tenant-dashboard/status";

/** An omitted charge is zero, not a validation failure. */
const amountOrZero = z
  .union([z.literal(""), moneySchema])
  .nullish()
  .transform((value) =>
    value === "" || value === null || value === undefined ? "0" : value,
  );

export const orderItemInputSchema = z.object({
  productVariantId: z.uuid("Choose a product variant."),
  quantity: z.coerce
    .number()
    .int("Enter a whole number.")
    .min(1, "Order at least one.")
    .max(10_000),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

/**
 * What an order screen may set.
 *
 * Line prices are absent on purpose: they are read from the variant on the
 * server and snapshotted onto the line. A client that could name its own price
 * could buy at any price it liked.
 */
export const orderInputSchema = z.object({
  /** Null is a walk-in or an unidentified WhatsApp buyer; the column allows it. */
  customerId: z.uuid().nullable().optional(),
  shippingAddressId: z.uuid().nullable().optional(),
  status: z.enum(ORDER_STATUSES).default("PENDING"),
  discount: amountOrZero,
  shippingFee: amountOrZero,
  tax: amountOrZero,
  items: z
    .array(orderItemInputSchema)
    .min(1, "Add at least one line.")
    .max(200),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

/** Unknown filter values are dropped, so a stale bookmark still lists. */
export const orderListQuerySchema = listQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  customerId: z.uuid().optional().catch(undefined),
});

export type OrderListQueryInput = z.infer<typeof orderListQuerySchema>;
