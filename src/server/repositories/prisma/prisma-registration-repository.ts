import { Prisma } from "@prisma/client";

import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import { prisma } from "@/server/db/prisma";
import type {
  CreatedRegistration,
  NewRegistration,
  RecordCheckOutcome,
  RegistrationCheckDecision,
  RegistrationListQuery,
  RegistrationRepository,
} from "@/server/repositories/contracts/registration-repository";
import type { PaginatedResult } from "@/types/repository";
import { REVIEW_QUEUE_STATUSES } from "@/types/status";

import {
  checkStatusToPrisma,
  checkTypeToPrisma,
  mapRegistration,
  mapRegistrationCheck,
  registrationStatusToPrisma,
} from "./mappers";

type RegistrationWithChecks = Prisma.TenantRegistrationGetPayload<{
  include: { checks: true; requestedPlan: true };
}>;

/** The Prisma spelling of `REVIEW_QUEUE_STATUSES`, for `where` clauses. */
const QUEUE_STATUSES = REVIEW_QUEUE_STATUSES.map(
  (status) => registrationStatusToPrisma[status],
);

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
    return registration ? mapRegistration(registration) : null;
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
      ...(query.status === undefined
        ? {}
        : {
            status: {
              in: (typeof query.status === "string"
                ? [query.status]
                : query.status
              ).map((status) => registrationStatusToPrisma[status]),
            },
          }),
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
      // Newest application first: the review queue is worked from the top, and
      // registration_code is not an arrival order.
      orderBy: { submittedAt: Prisma.SortOrder.desc },
      include: INCLUDE,
    });
    const total = await prisma.tenantRegistration.count({ where });

    const items = await Promise.all(registrations.map(toDetail));
    return { items, total, limit, offset };
  }

  async countPending(): Promise<number> {
    // Both queue statuses: a reviewer opening an application does not decide it.
    return prisma.tenantRegistration.count({
      where: { status: { in: QUEUE_STATUSES } },
    });
  }

  async existsForEmail(email: string): Promise<boolean> {
    const existing = await prisma.tenantRegistration.findFirst({
      // A rejected applicant may re-apply; a live one may not queue twice.
      where: {
        ownerEmail: email,
        status: { in: [...QUEUE_STATUSES, "APPROVED"] },
      },
      select: { id: true },
    });

    return existing !== null;
  }

  async create(values: NewRegistration): Promise<CreatedRegistration> {
    const code = `REG-${Date.now().toString(36).toUpperCase()}`;

    // The registration and its checklist are one unit: a registration with no
    // checks would reach the review queue with nothing to action.
    const created = await prisma.tenantRegistration.create({
      data: {
        ...values,
        registrationCode: code,
        status: "SUBMITTED",
        checks: {
          create: [
            { checkType: "BUSINESS_VERIFICATION" },
            { checkType: "PAYMENT_METHOD_LINKED" },
            { checkType: "WHATSAPP_API_APPROVAL" },
          ],
        },
      },
      select: { id: true },
    });

    return { id: created.id, registrationCode: code };
  }

  async recordCheck(
    decision: RegistrationCheckDecision,
  ): Promise<RecordCheckOutcome> {
    // One transaction so the "still pending" guard cannot be overtaken by an
    // approval landing between the read and the write.
    return prisma.$transaction(async (tx) => {
      const registration = await tx.tenantRegistration.findUnique({
        where: { id: decision.registrationId },
        select: { status: true },
      });

      if (!registration) return { ok: false, reason: "not-found" } as const;

      if (!QUEUE_STATUSES.includes(registration.status)) {
        return { ok: false, reason: "not-pending" } as const;
      }

      const updated = await tx.tenantRegistrationCheck.updateMany({
        where: {
          tenantRegistrationId: decision.registrationId,
          checkType: checkTypeToPrisma[decision.checkType],
        },
        data: {
          status: checkStatusToPrisma[decision.status],
          notes: decision.notes,
          checkedAt: new Date(),
          checkedBy: decision.reviewerId,
        },
      });

      return updated.count === 0
        ? ({ ok: false, reason: "not-found" } as const)
        : ({ ok: true } as const);
    });
  }
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
    registration: mapRegistration(registration),
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
