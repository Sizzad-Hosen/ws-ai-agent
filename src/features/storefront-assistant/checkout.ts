import "server-only";

import { fromCents, toCents } from "@/features/tenant-dashboard/money";
import { createOrder } from "@/features/tenant-dashboard/orders/service";
import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import { findStorefrontVariant, type StorefrontVariant } from "./catalogue";
import type { AssistantDraft } from "./session";
import type { AssistantSettings } from "./settings";

/**
 * Turning a chat into an order.
 *
 * The prices here are the shop's, not the conversation's. Every figure is
 * recomputed from the catalogue at the moment it is quoted and again at the
 * moment the order is written, and the model is never asked for one — it
 * cannot be, because none of these functions take a price argument. That is
 * the property the reference agent describes as "the model may classify
 * language and intent, but it cannot supply a trusted product ID or change
 * commerce data", and it is what makes an AI-taken order safe to bill.
 */

export interface OrderSummary {
  readonly variant: StorefrontVariant;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly productTotal: string;
  readonly deliveryCharge: string;
  readonly total: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerAddress: string;
  readonly inStock: boolean;
}

/**
 * The delivery charge for an address.
 *
 * Two rates, matched on the shop's own home city — the same deterministic rule
 * as the reference agent, with the city and both amounts moved out of the code
 * and into the shop's settings, because a Chattogram shop charging Dhaka rates
 * is not a rule anyone would want hard-coded.
 */
export function deliveryChargeFor(
  address: string,
  settings: AssistantSettings,
): string {
  const home = settings.homeCity.trim().toLowerCase();
  const inside = home !== "" && address.toLowerCase().includes(home);

  return inside ? settings.deliveryInsideCity : settings.deliveryOutsideCity;
}

export type SummaryOutcome =
  | { readonly ok: true; readonly summary: OrderSummary }
  | { readonly ok: false; readonly reason: "incomplete" | "unknown-variant" };

/** Prices the draft as it currently stands, re-reading the variant. */
export async function summarizeDraft(
  db: TenantPrismaClient,
  draft: AssistantDraft,
  settings: AssistantSettings,
): Promise<SummaryOutcome> {
  if (
    !draft.variantId ||
    !draft.quantity ||
    !draft.customerName ||
    !draft.customerPhone ||
    !draft.customerAddress
  ) {
    return { ok: false, reason: "incomplete" };
  }

  const variant = await findStorefrontVariant(db, draft.variantId);

  if (!variant) return { ok: false, reason: "unknown-variant" };

  const productTotalCents = toCents(variant.price) * draft.quantity;
  const deliveryCharge = deliveryChargeFor(draft.customerAddress, settings);

  return {
    ok: true,
    summary: {
      variant,
      quantity: draft.quantity,
      unitPrice: variant.price,
      productTotal: fromCents(productTotalCents),
      deliveryCharge,
      total: fromCents(productTotalCents + toCents(deliveryCharge)),
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress,
      inStock: variant.available >= draft.quantity,
    },
  };
}

export type PlacementOutcome =
  | {
      readonly ok: true;
      readonly orderId: string;
      readonly orderNumber: string;
      readonly total: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "incomplete"
        | "unknown-variant"
        | "out-of-stock"
        | "blocked"
        | "failed";
    };

/**
 * Writes the order the summary describes.
 *
 * The customer is matched on their phone number, so a returning shopper builds
 * one history rather than a new record per conversation. The address is stored
 * against them for the same reason, and because an order with no address is an
 * order nobody can deliver.
 *
 * The order itself goes through the same service the dashboard uses. There is
 * no second write path for AI-taken orders: they are ordinary orders, in the
 * ordinary tables, and the shop owner reads them on the ordinary Orders screen.
 */
export async function placeOrder(
  db: TenantPrismaClient,
  draft: AssistantDraft,
  settings: AssistantSettings,
): Promise<PlacementOutcome> {
  const priced = await summarizeDraft(db, draft, settings);

  if (!priced.ok) return { ok: false, reason: priced.reason };

  const { summary } = priced;

  if (!summary.inStock) return { ok: false, reason: "out-of-stock" };

  const existing = await db.customer.findFirst({
    where: { phone: summary.customerPhone },
    select: { id: true, status: true },
  });

  // A shop that blocked this number blocked it on every channel. The assistant
  // is not a way around a decision the owner already made.
  if (existing?.status === "BLOCKED") return { ok: false, reason: "blocked" };

  const customerId =
    existing?.id ??
    (
      await db.customer.create({
        data: {
          name: summary.customerName,
          phone: summary.customerPhone,
          status: "ACTIVE",
        },
        select: { id: true },
      })
    ).id;

  const address = await db.address.create({
    data: {
      customerId,
      label: "Storefront chat",
      recipientName: summary.customerName,
      phone: summary.customerPhone,
      addressLine: summary.customerAddress,
      // The schema splits city out of the address line, and a chat gives one
      // free-text line. The home city is recorded when the address names it,
      // so the delivery rate that was charged stays legible on the order.
      city: cityFor(summary.customerAddress, settings),
      isDefault: existing === null,
    },
    select: { id: true },
  });

  const created = await createOrder(db, {
    customerId,
    shippingAddressId: address.id,
    status: "PENDING",
    discount: "0",
    shippingFee: summary.deliveryCharge,
    tax: "0",
    items: [
      {
        productVariantId: summary.variant.variantId,
        quantity: summary.quantity,
      },
    ],
  });

  if (!created.ok) {
    return {
      ok: false,
      reason:
        created.reason === "unknown-variant" ? "unknown-variant" : "failed",
    };
  }

  const order = await db.order.findUnique({
    where: { id: created.id },
    select: { orderNumber: true, total: true },
  });

  return {
    ok: true,
    orderId: created.id,
    orderNumber: order?.orderNumber ?? "",
    total: summary.total,
  };
}

/** The home city when the address names it; the first line otherwise. */
function cityFor(address: string, settings: AssistantSettings): string {
  const home = settings.homeCity.trim();

  if (home !== "" && address.toLowerCase().includes(home.toLowerCase())) {
    return home;
  }

  const tail = address.split(",").at(-1)?.trim() ?? "";

  return (tail === "" ? address : tail).slice(0, 100);
}
