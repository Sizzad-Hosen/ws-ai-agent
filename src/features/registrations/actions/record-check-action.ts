"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { AUDIT_ACTIONS, recordAudit } from "@/server/audit/audit-log";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { REGISTRATION_CHECK_TYPES } from "@/types/status";

export interface RecordCheckResult {
  readonly success: boolean;
  readonly message: string;
}

/** Free-text note length, matched to what the checklist card can show. */
const MAX_NOTES = 500;

const inputSchema = z.object({
  registrationId: z.uuid("Unknown registration."),
  checkType: z.enum(REGISTRATION_CHECK_TYPES),
  status: z.enum(["passed", "failed"]),
  notes: z.string().trim().max(MAX_NOTES).optional(),
});

/**
 * Records a reviewer's verdict on one item of the registration checklist.
 *
 * Screen 03 gates approval on "all checks must pass", but nothing could move a
 * check off `pending`: the checklist button had no action behind it, and the
 * port had no method. Every registration arriving from the public site was
 * therefore unapprovable, and no tenant could ever be created from one. The
 * seeded fixtures hid it by being written with their checks already passed.
 *
 * The verdict is the administrator's, not an automated result. Nothing here
 * contacts a registry, a payment processor or Meta; claiming an external system
 * had verified anything would be a fabrication, so the entry is attributed to
 * the person who recorded it via `checked_by` and shown as "Checked by" on the
 * card.
 */
export async function recordCheckAction(
  input: unknown,
): Promise<RecordCheckResult> {
  const actor = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_MANAGE);

  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "That request was not understood." };
  }

  const { registrationId, checkType, status, notes } = parsed.data;

  const outcome = await repositories.registrations.recordCheck({
    registrationId,
    checkType,
    status,
    notes: notes === undefined || notes === "" ? null : notes,
    reviewerId: actor.id,
  });

  if (!outcome.ok) {
    return {
      success: false,
      message:
        outcome.reason === "not-pending"
          ? "This registration has already been reviewed, so its checklist is closed."
          : "That check no longer exists.",
    };
  }

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.REGISTRATION_CHECK,
    entityType: "registration",
    entityId: registrationId,
    metadata: { checkType, status },
  });

  revalidatePath(ROUTES.bo.registration(registrationId));
  revalidatePath(ROUTES.bo.registrations);

  return {
    success: true,
    message:
      status === "passed" ? "Check marked passed." : "Check marked failed.",
  };
}
