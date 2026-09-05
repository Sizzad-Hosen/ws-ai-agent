"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface TenantApprovalResult {
  readonly success: boolean;
  readonly message: string;
}

const inputSchema = z.object({
  tenantId: z.uuid("Unknown tenant."),
  decision: z.enum(["approve", "reject"]),
});

/**
 * Approves or rejects a tenant awaiting review.
 *
 * The transition is validated against the tenant's current status on the
 * server: a disabled button in the table is a convenience, not a control, and
 * a second click on an already-decided tenant must not silently re-decide it.
 *
 * Note: this action is not yet audited. `platform_audit_logs` is not in the
 * ERD (§2.3), so there is nowhere to record who approved what. That gap is
 * tracked and should be closed before this ships to a real environment.
 */
export async function decideTenantApprovalAction(
  input: unknown,
): Promise<TenantApprovalResult> {
  await requirePermission(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { tenantId, decision } = parsed.data;
  const tenant = await repositories.tenants.findById(tenantId);

  if (!tenant) {
    return { success: false, message: "That tenant no longer exists." };
  }

  if (tenant.approvalStatus !== "pending_review") {
    return {
      success: false,
      message: `${tenant.businessName} is no longer awaiting review.`,
    };
  }

  try {
    await repositories.tenants.updateApprovalStatus(
      tenantId,
      decision === "approve" ? "active" : "rejected",
    );
  } catch (error: unknown) {
    console.error("Unable to record the tenant approval decision.", error);
    return {
      success: false,
      message: "That decision could not be saved. Please try again.",
    };
  }

  revalidatePath(ROUTES.bo.tenants);
  revalidatePath(ROUTES.bo.tenant(tenantId));

  return {
    success: true,
    message:
      decision === "approve"
        ? `${tenant.businessName} approved.`
        : `${tenant.businessName} rejected.`,
  };
}
