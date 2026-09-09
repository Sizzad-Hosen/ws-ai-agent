/**
 * One submitted registration with three pending checks.
 *
 * The review screen needs a row to review. All three checks stay pending, so
 * the reviewer can record each one and watch the approve control unlock. A
 * seeded half-reviewed row would hide that transition.
 *
 * This registration must stay unapproved. Approving it is the manual
 * walkthrough in step 8.
 */
import {
  RegistrationCheckStatus,
  RegistrationCheckType,
  RegistrationStatus,
  type Plan,
} from "@prisma/client";

import { prisma } from "./client";
import { daysAgo } from "./helpers";

const REGISTRATION_CODE = "REG-2026-0042";

const CHECKS = [
  RegistrationCheckType.BUSINESS_VERIFICATION,
  RegistrationCheckType.PAYMENT_METHOD_LINKED,
  RegistrationCheckType.WHATSAPP_API_APPROVAL,
] as const;

export async function seedRegistration(plan: Plan): Promise<void> {
  const fields = {
    businessName: "Silk Route Textiles",
    ownerName: "Imran Hossain",
    ownerEmail: "imran@silkroutetextiles.example",
    ownerPhone: "+8801800000002",
    industry: "Textiles",
    region: "Chattogram",
    requestedPlanId: plan.id,
    status: RegistrationStatus.SUBMITTED,
    submittedAt: daysAgo(2),
  };

  const registration = await prisma.tenantRegistration.upsert({
    where: { registrationCode: REGISTRATION_CODE },
    update: fields,
    create: { registrationCode: REGISTRATION_CODE, ...fields },
    select: { id: true },
  });

  for (const checkType of CHECKS) {
    await prisma.tenantRegistrationCheck.upsert({
      where: {
        tenantRegistrationId_checkType: {
          tenantRegistrationId: registration.id,
          checkType,
        },
      },
      update: {
        status: RegistrationCheckStatus.PENDING,
        checkedAt: null,
        checkedBy: null,
        notes: null,
      },
      create: {
        tenantRegistrationId: registration.id,
        checkType,
        status: RegistrationCheckStatus.PENDING,
      },
    });
  }
}
