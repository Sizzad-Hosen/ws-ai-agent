"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  tenantHref,
  tenantRecordHref,
} from "@/features/tenant-dashboard/routes";
import { tenantSlugSchema } from "@/features/tenant-dashboard/schemas";
import { CUSTOMER_STATUSES } from "@/features/tenant-dashboard/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

import { addressInputSchema, customerInputSchema } from "./schemas";
import {
  createAddress,
  createCustomer,
  deleteAddress,
  deleteCustomer,
  setCustomerStatus,
  updateAddress,
  updateCustomer,
} from "./service";

/**
 * Customer mutations.
 *
 * Every one re-runs the full guard rather than trusting an id from the form.
 * The slug decides which database is opened, so an id belonging to another
 * tenant is not a row this connection can reach — it does not need to be
 * checked against an owner column, because there is no shared table.
 */

export interface CustomerActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
  /** Set on a create, so the caller can navigate to the new row. */
  readonly id?: string;
}

const idSchema = z.uuid("Unknown customer.");

export async function saveCustomerAction(
  slug: unknown,
  customerId: unknown,
  input: unknown,
): Promise<CustomerActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return { success: false, message: "That workspace address is not valid." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = customerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Absent id creates; present id updates. Anything else is a malformed call.
  const isUpdate = customerId !== null && customerId !== undefined;
  const parsedId = isUpdate ? idSchema.safeParse(customerId) : null;

  if (parsedId && !parsedId.success) {
    return { success: false, message: "Unknown customer." };
  }

  const outcome = parsedId
    ? await updateCustomer(tenant.db, parsedId.data, parsed.data)
    : await createCustomer(tenant.db, parsed.data);

  if (!outcome.ok) {
    return { success: false, message: "That customer no longer exists." };
  }

  revalidateCustomer(parsedSlug.data, outcome.id);

  return {
    success: true,
    message: parsedId ? "Customer updated." : "Customer created.",
    id: outcome.id,
  };
}

export async function deleteCustomerAction(
  slug: unknown,
  customerId: unknown,
): Promise<CustomerActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(customerId);

  if (!parsedSlug.success || !parsedId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteCustomer(tenant.db, parsedId.data);

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "has-orders"
          ? "This customer has orders, so their record has to stay. Block them instead."
          : "That customer no longer exists.",
    };
  }

  revalidatePath(tenantHref(parsedSlug.data, "customers"));

  return { success: true, message: "Customer deleted." };
}

export async function setCustomerStatusAction(
  slug: unknown,
  customerId: unknown,
  status: unknown,
): Promise<CustomerActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedId = idSchema.safeParse(customerId);
  const parsedStatus = z.enum(CUSTOMER_STATUSES).safeParse(status);

  if (!parsedSlug.success || !parsedId.success || !parsedStatus.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await setCustomerStatus(
    tenant.db,
    parsedId.data,
    parsedStatus.data,
  );

  if (!outcome.ok) {
    return { success: false, message: "That customer no longer exists." };
  }

  revalidateCustomer(parsedSlug.data, parsedId.data);

  return {
    success: true,
    message:
      parsedStatus.data === "BLOCKED"
        ? "Customer blocked."
        : "Customer unblocked.",
  };
}

export async function saveAddressAction(
  slug: unknown,
  customerId: unknown,
  addressId: unknown,
  input: unknown,
): Promise<CustomerActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedCustomerId = idSchema.safeParse(customerId);

  if (!parsedSlug.success || !parsedCustomerId.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const parsed = addressInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const isUpdate = addressId !== null && addressId !== undefined;
  const parsedAddressId = isUpdate ? idSchema.safeParse(addressId) : null;

  if (parsedAddressId && !parsedAddressId.success) {
    return { success: false, message: "Unknown address." };
  }

  const outcome = parsedAddressId
    ? await updateAddress(
        tenant.db,
        parsedCustomerId.data,
        parsedAddressId.data,
        parsed.data,
      )
    : await createAddress(tenant.db, parsedCustomerId.data, parsed.data);

  if (!outcome.ok) {
    return { success: false, message: "That address no longer exists." };
  }

  revalidateCustomer(parsedSlug.data, parsedCustomerId.data);

  return {
    success: true,
    message: parsedAddressId ? "Address updated." : "Address added.",
    id: outcome.id,
  };
}

export async function deleteAddressAction(
  slug: unknown,
  customerId: unknown,
  addressId: unknown,
): Promise<CustomerActionResult> {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  const parsedCustomerId = idSchema.safeParse(customerId);
  const parsedAddressId = idSchema.safeParse(addressId);

  if (
    !parsedSlug.success ||
    !parsedCustomerId.success ||
    !parsedAddressId.success
  ) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenant } = await requireTenantPage(parsedSlug.data);
  const outcome = await deleteAddress(
    tenant.db,
    parsedCustomerId.data,
    parsedAddressId.data,
  );

  if (!outcome.ok) {
    return { success: false, message: "That address no longer exists." };
  }

  revalidateCustomer(parsedSlug.data, parsedCustomerId.data);

  return { success: true, message: "Address removed." };
}

/** The list and the customer's own page both show what a write changed. */
function revalidateCustomer(slug: string, customerId: string): void {
  revalidatePath(tenantHref(slug, "customers"));
  revalidatePath(tenantRecordHref(slug, "customers", customerId));
}
