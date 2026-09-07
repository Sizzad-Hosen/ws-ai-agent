"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { ORDER_STATUSES } from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import { orderInputSchema } from "./schemas";
import {
  createOrder,
  deleteOrder,
  setOrderStatus,
  updateOrder,
  type OrderWriteFailure,
} from "./service";

/**
 * Order mutations.
 *
 * Every one re-runs the full guard rather than trusting an id from the form.
 * The slug decides which database is opened, so an id belonging to another
 * tenant is not a row this connection can reach — it does not need to be
 * checked against an owner column, because there is no shared table.
 */

export interface OrderActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
  /** Set on a create, so the caller can navigate to the new order. */
  readonly id?: string;
}

const idSchema = z.uuid("Unknown order.");

export async function saveOrderAction(
  slug: unknown,
  orderId: unknown,
  input: unknown,
): Promise<OrderActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = orderInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Absent id creates; present id updates. Anything else is a malformed call.
  const isUpdate = orderId !== null && orderId !== undefined;
  const parsedId = isUpdate ? idSchema.safeParse(orderId) : null;

  if (parsedId && !parsedId.success) {
    return { success: false, message: "Unknown order." };
  }

  const outcome = parsedId
    ? await updateOrder(tenant.db, parsedId.data, parsed.data)
    : await createOrder(tenant.db, parsed.data);

  if (!outcome.ok) {
    return { success: false, message: writeFailureMessage(outcome.reason) };
  }

  revalidateOrder(parsedSlug.data, outcome.id);

  return {
    success: true,
    message: parsedId ? "Order updated." : "Order created.",
    id: outcome.id,
  };
}

export async function deleteOrderAction(
  slug: unknown,
  orderId: unknown,
): Promise<OrderActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(orderId);

  if (!parsedSlug.success || !parsedId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteOrder(tenant.db, parsedId.data);

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "has-payments"
          ? "This order has payments against it, so it has to stay. Cancel or refund it instead."
          : "That order no longer exists.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "orders"));

  return { success: true, message: "Order deleted." };
}

export async function setOrderStatusAction(
  slug: unknown,
  orderId: unknown,
  status: unknown,
): Promise<OrderActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(orderId);
  const parsedStatus = z.enum(ORDER_STATUSES).safeParse(status);

  if (!parsedSlug.success || !parsedId.success || !parsedStatus.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await setOrderStatus(
    tenant.db,
    parsedId.data,
    parsedStatus.data,
  );

  if (!outcome.ok) {
    return { success: false, message: "That order no longer exists." };
  }

  revalidateOrder(parsedSlug.data, parsedId.data);

  return { success: true, message: "Order status updated." };
}

/** The list and the order's own page both show what a write changed. */
function revalidateOrder(slug: string, orderId: string): void {
  revalidatePath(tenantHref(slug, "orders"));
  revalidatePath(tenantRecordHref(slug, "orders", orderId));
}

function writeFailureMessage(reason: OrderWriteFailure): string {
  switch (reason) {
    case "unknown-customer":
      return "That customer no longer exists.";
    case "unknown-variant":
      return "One of these lines points at a product variant that no longer exists.";
    case "address-mismatch":
      return "That delivery address does not belong to this customer.";
    case "discount-too-large":
      return "The discount cannot be more than the value of the goods.";
    case "number-collision":
      return "Could not allocate an order number. Try again.";
    default:
      return "That order no longer exists.";
  }
}
