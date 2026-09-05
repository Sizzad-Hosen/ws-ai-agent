import { Prisma } from "@prisma/client";

import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import { prisma } from "@/server/db/prisma";
import type {
  NewRegistration,
  RegistrationListQuery,
  RegistrationRepository,
} from "@/server/repositories/contracts/registration-repository";
import type { PaginatedResult } from "@/types/repository";

import {
  mapRegistration,
  mapRegistrationCheck,
  registrationStatusToPrisma,
} from "./mappers";

type RegistrationWithChecks = Prisma.TenantRegistrationGetPayload<{
  include: { checks: true; requestedPlan: true };
}>;

const INCLUDE = {
  checks: { orderBy: { checkType: Prisma.SortOrder.asc } },
  requestedPlan: true,
} as const;

export class PrismaRegistrationRepository implements RegistrationRepository {
  async findById(id: string): Promise<TenantRegistration | null> {
    const registration = await prisma.tenantRegistration.findUnique({
      where: { id },
      include: INCLUDE,
    });
    return registration ? withSubmittedAt(registration) : null;
  }

  async findDetailById(id: string): Promise<RegistrationDetail | null> {
    const registration = await prisma.tenantRegistration.findUnique({
      where: { id },
      include: INCLUDE,
    });
    return registration ? await toDetail(registration) : null;
  }

  async findMany(
    query: RegistrationListQuery = {},
  ): Promise<PaginatedResult<RegistrationDetail>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: Prisma.TenantRegistrationWhereInput = {
      ...(query.status
        ? { status: registrationStatusToPrisma[query.status] }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                businessName: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                registrationCode: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                ownerEmail: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const registrations = await prisma.tenantRegistration.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { registrationCode: Prisma.SortOrder.asc },
      include: INCLUDE,
    });
    const total = await prisma.tenantRegistration.count({ where });

    const items = await Promise.all(registrations.map(toDetail));
    return { items, total, limit, offset };
  }

  async countPending(): Promise<number> {
    return prisma.tenantRegistration.count({
      where: { status: "PENDING_REVIEW" },
    });
  }

  async existsForEmail(email: string): Promise<boolean> {
    const existing = await prisma.tenantRegistration.findFirst({
      // A rejected applicant may re-apply; a live one may not queue twice.
      where: {
        ownerEmail: email,
        status: { in: ["PENDING_REVIEW", "APPROVED"] },
      },
      select: { id: true },
    });

    return existing !== null;
  }

  async create(values: NewRegistration): Promise<string> {
    const code = `REG-${Date.now().toString(36).toUpperCase()}`;

    // The registration and its checklist are one unit: a registration with no
    // checks would reach the review queue with nothing to action.
    await prisma.tenantRegistration.create({
      data: {
        ...values,
        registrationCode: code,
        status: "PENDING_REVIEW",
        checks: {
          create: [
            { checkType: "BUSINESS_VERIFICATION" },
            { checkType: "PAYMENT_METHOD_LINKED" },
            { checkType: "WHATSAPP_API_APPROVAL" },
          ],
        },
      },
    });

    return code;
  }
}

/** Earliest completed check, used as a stand-in for a missing created_at. */
function earliestCheckedAt(
  registration: RegistrationWithChecks,
): string | null {
  const timestamps = registration.checks
    .map((check) => check.checkedAt)
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  return timestamps.length === 0
    ? null
    : new Date(Math.min(...timestamps)).toISOString();
}

function withSubmittedAt(
  registration: RegistrationWithChecks,
): TenantRegistration {
  return {
    ...mapRegistration(registration),
    submittedAt: earliestCheckedAt(registration),
  };
}

async function toDetail(
  registration: RegistrationWithChecks,
): Promise<RegistrationDetail> {
  // `checked_by` is a bare UUID with no FK (§2.9c), so reviewer names need a
  // separate lookup and a deleted admin simply resolves to null.
  const reviewerIds = [
    ...new Set(
      registration.checks
        .map((check) => check.checkedBy)
        .filter((value): value is string => value !== null),
    ),
  ];

  const reviewers =
    reviewerIds.length === 0
      ? []
      : await prisma.adminUser.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true },
        });

  const names = new Map(reviewers.map((admin) => [admin.id, admin.name]));

  return {
    registration: withSubmittedAt(registration),
    requestedPlanName: registration.requestedPlan?.name ?? null,
    checks: registration.checks.map((check) =>
      mapRegistrationCheck(
        check,
        check.checkedBy === null ? null : (names.get(check.checkedBy) ?? null),
      ),
    ),
    // The WhatsApp Business number on screen 03 has no column in the ERD.
    whatsappBusinessNumber: registration.ownerPhone,
  };
}
