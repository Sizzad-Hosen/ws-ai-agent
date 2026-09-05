"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  applyTenantDecision,
  TENANT_DECISIONS,
} from "@/features/tenants/lifecycle";
import { requirePermission } from "@/server/auth/authorization";

export type { TenantDecision } from "@/features/tenants/lifecycle";

export interface TenantStatusResult {
  readonly success: boolean;
  readonly message: string;
}

const inputSchema = z.object({
  tenantId: z.uuid("Unknown tenant."),
  decision: z.enum(TENANT_DECISIONS),
});

/**
 * Applies an approval or lifecycle decision to a tenant.
 *
 * The transition rules themselves live in `@/features/tenants/lifecycle`, which
 * the REST route shares, so the two entry points cannot disagree.
 */
export async function decideTenantStatusAction(
  input: unknown,
): Promise<TenantStatusResult> {
  await requirePermission(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenantId, decision } = parsed.data;
  const result = await applyTenantDecision(tenantId, decision);

  if (result.outcome !== "applied") {
    return { success: false, message: result.message };
  }

  revalidatePath(ROUTES.bo.tenants);
  revalidatePath(ROUTES.bo.tenant(tenantId));

  return { success: true, message: result.message };
}
