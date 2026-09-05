/** Pending tenant registrations and their review checklists (screen 03). */

import {
  RegistrationCheckStatus,
  RegistrationCheckType,
  RegistrationStatus,
} from "@prisma/client";
import { prisma } from "./client";
import { daysAgo } from "./helpers";

export async function seedRegistrations(
  planIds: Readonly<Record<string, string>>,
  reviewerId: string,
): Promise<void> {
  const registrations = [
    {
      registrationCode: "REG-99281",
      businessName: "Urban Style BD",
      ownerName: "Rahim",
      ownerEmail: "rahim@urbanstyle.bd",
      ownerPhone: "+1 234 567 890",
      industry: "Fashion & Retail",
      region: "US-East-1",
      planCode: "enterprise",
      checks: [
        {
          checkType: RegistrationCheckType.BUSINESS_VERIFICATION,
          status: RegistrationCheckStatus.PASSED,
          notes: "Documents verified via automated check.",
        },
        {
          checkType: RegistrationCheckType.PAYMENT_METHOD_LINKED,
          status: RegistrationCheckStatus.PASSED,
          notes: "Billing customer record established.",
        },
        {
          checkType: RegistrationCheckType.WHATSAPP_API_APPROVAL,
          status: RegistrationCheckStatus.PENDING,
          notes: "Pending Meta business verification.",
        },
      ],
    },
    {
      registrationCode: "REG-99290",
      businessName: "Coastal Coffee Co.",
      ownerName: "Ilana Devi",
      ownerEmail: "ilana@coastalcoffee.io",
      ownerPhone: "+1 415 555 0142",
      industry: "Food & Beverage",
      region: "US-West-2",
      planCode: "starter",
      checks: [
        {
          checkType: RegistrationCheckType.BUSINESS_VERIFICATION,
          status: RegistrationCheckStatus.PASSED,
          notes: "Documents verified via automated check.",
        },
        {
          checkType: RegistrationCheckType.PAYMENT_METHOD_LINKED,
          status: RegistrationCheckStatus.PENDING,
          notes: null,
        },
        {
          checkType: RegistrationCheckType.WHATSAPP_API_APPROVAL,
          status: RegistrationCheckStatus.PENDING,
          notes: "Pending Meta business verification.",
        },
      ],
    },
    {
      registrationCode: "REG-99291",
      businessName: "Vertex Analytics",
      ownerName: "Samuel Otieno",
      ownerEmail: "sam@vertex.africa",
      ownerPhone: "+254 20 555 0110",
      industry: "Professional Services",
      region: "EU-West-1",
      planCode: "business",
      checks: [
        {
          checkType: RegistrationCheckType.BUSINESS_VERIFICATION,
          status: RegistrationCheckStatus.FAILED,
          notes: "Registration certificate could not be matched to the tax ID.",
        },
        {
          checkType: RegistrationCheckType.PAYMENT_METHOD_LINKED,
          status: RegistrationCheckStatus.PASSED,
          notes: "Billing customer record established.",
        },
        {
          checkType: RegistrationCheckType.WHATSAPP_API_APPROVAL,
          status: RegistrationCheckStatus.PENDING,
          notes: null,
        },
      ],
    },
  ] as const;

  for (const entry of registrations) {
    const registration = await prisma.tenantRegistration.upsert({
      where: { registrationCode: entry.registrationCode },
      update: {},
      create: {
        registrationCode: entry.registrationCode,
        businessName: entry.businessName,
        ownerName: entry.ownerName,
        ownerEmail: entry.ownerEmail,
        ownerPhone: entry.ownerPhone,
        industry: entry.industry,
        region: entry.region,
        requestedPlanId: planIds[entry.planCode],
        status: RegistrationStatus.PENDING_REVIEW,
      },
    });

    for (const check of entry.checks) {
      const resolved = check.status !== RegistrationCheckStatus.PENDING;

      await prisma.tenantRegistrationCheck.upsert({
        where: {
          tenantRegistrationId_checkType: {
            tenantRegistrationId: registration.id,
            checkType: check.checkType,
          },
        },
        update: {},
        create: {
          tenantRegistrationId: registration.id,
          checkType: check.checkType,
          status: check.status,
          notes: check.notes,
          checkedAt: resolved ? daysAgo(3) : null,
          checkedBy: resolved ? reviewerId : null,
        },
      });
    }
  }
}
