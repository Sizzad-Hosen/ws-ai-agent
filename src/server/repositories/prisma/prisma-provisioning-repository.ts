import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  buildWebsiteUrl,
  deriveDatabaseName,
  deriveSubdomain,
  formatTenantCode,
  withSuffix,
} from "@/features/registrations/provisioning";
import { isReservedTenantSlug } from "@/constants/reserved-slugs";
import { prisma } from "@/server/db/prisma";
import type {
  DatabaseConnectionPointers,
  DatabaseTarget,
  ProvisionInput,
  ProvisionOutcome,
  ProvisioningRepository,
  RejectInput,
} from "@/server/repositories/contracts/provisioning-repository";
import { REVIEW_QUEUE_STATUSES, type ProvisioningStatus } from "@/types/status";

import {
  provisioningMap,
  provisioningToPrisma,
  registrationStatusToPrisma,
} from "./mappers";

/** The Prisma spelling of the review-queue statuses, for where clauses. */
const QUEUE_STATUSES = REVIEW_QUEUE_STATUSES.map(
  (status) => registrationStatusToPrisma[status],
);

/** How long an owner has to accept the invitation before it must be reissued. */
const INVITE_VALID_MS = 7 * 24 * 60 * 60 * 1000;

/** Attempts at a free host label before giving up. */
const MAX_LABEL_ATTEMPTS = 25;

/** Sentinel returned from the transaction so the caller can tell the two
 * rollback reasons apart: a stale registration versus a duplicate owner. */
const DUPLICATE_OWNER = "duplicate-owner" as const;

/** The chosen plan vanished between selection and the transaction. */
const MISSING_PLAN = "missing-plan" as const;

function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Placeholder connection references for a database that does not exist yet.
 *
 * These are *pointers*, never credentials (S-03). Nothing here provisions a
 * real database: that is an infrastructure job an external provisioner does,
 * which is why the row is written with status PENDING and a secret reference
 * that no secret manager can yet resolve. The record states the intent to
 * provision; it does not claim the database is ready.
 */
function connectionReferences(subdomain: string, region: string) {
  return {
    hostReference: `pending/${region.toLowerCase()}/${subdomain}`,
    port: 5432,
    usernameReference: `tenant/${subdomain}/username`,
    secretReference: `tenant/${subdomain}/password`,
  };
}

export class PrismaProvisioningRepository implements ProvisioningRepository {
  async provisionApprovedTenant(
    input: ProvisionInput,
  ): Promise<ProvisionOutcome> {
    const registration = await prisma.tenantRegistration.findUnique({
      where: { id: input.registrationId },
    });

    if (!registration || !QUEUE_STATUSES.includes(registration.status)) {
      return { ok: false, reason: "not-pending" };
    }

    const base = deriveSubdomain(registration.businessName);

    if (base === null) {
      return { ok: false, reason: "no-subdomain" };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction so two reviewers clicking Approve at
        // once cannot both provision the same registration.
        const locked = await tx.tenantRegistration.updateMany({
          where: { id: input.registrationId, status: { in: QUEUE_STATUSES } },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: input.actorId,
          },
        });

        if (locked.count === 0) return null;

        // Re-checked inside the transaction. `tenants.registration_id` is
        // unique, so one application cannot provision twice; the owner's email
        // is the separate guard against two *different* applications from one
        // owner. A unique index on the column is what actually makes this safe
        // against two reviewers approving duplicate registrations at the same
        // moment; this read only turns that constraint into an explanation
        // instead of a raw violation.
        const existing = await tx.tenant.findFirst({
          where: { ownerEmail: registration.ownerEmail, deletedAt: null },
          select: { id: true },
        });

        if (existing) return DUPLICATE_OWNER;

        const slug = await this.claimSubdomain(tx, base);
        const databaseName = deriveDatabaseName(slug);
        const tenantCode = await this.nextTenantCode(tx);

        // Limits are copied from the catalogue now and never re-read. A plan
        // edit must not silently re-limit an existing subscriber, which is
        // exactly what reading plans at usage time would do.
        const plan = await tx.plan.findUnique({
          where: { id: input.planId },
          select: {
            code: true,
            maxWhatsappNumbers: true,
            maxAiMessages: true,
            maxProducts: true,
          },
        });

        if (!plan) return MISSING_PLAN;

        const tenant = await tx.tenant.create({
          data: {
            tenantCode,
            slug,
            businessName: registration.businessName,
            ownerName: registration.ownerName,
            ownerEmail: registration.ownerEmail,
            ownerPhone: registration.ownerPhone,
            industry: registration.industry,
            businessRegion: registration.region,
            // The application this tenant came from, so screen 04 can cite it
            // instead of leaving the registration reference blank.
            registrationId: input.registrationId,
            // The verdict, and separately the workspace state. Approved is not
            // running: the database still has to be built.
            approvalStatus: "APPROVED",
            status: "PROVISIONING",
            approvedAt: new Date(),
            approvedBy: input.actorId,
            database: {
              create: {
                databaseName,
                ...connectionReferences(slug, input.region),
                status: "PENDING",
                schemaVersion: "0",
                region: input.region,
              },
            },
          },
          select: { id: true, tenantCode: true },
        });

        // The owner, invited rather than active: nobody has set a password yet,
        // so password_hash stays null until they do. The invitations table is
        // out of MVP, which is why the invite lives on this row.
        const owner = await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            email: registration.ownerEmail,
            name: registration.ownerName,
            phone: registration.ownerPhone,
            role: "OWNER",
            status: "INVITED",
            isOwner: true,
            // Only the hash is stored. The token goes to the owner by email and
            // is not recoverable from here.
            inviteTokenHash: hashInviteToken(createInviteToken()),
            inviteExpiresAt: new Date(Date.now() + INVITE_VALID_MS),
          },
          select: { id: true },
        });

        // Closes the circular pair: the tenant row had to exist first so the
        // owner could reference it, and now points back at the owner.
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { ownerTenantUserId: owner.id },
        });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: input.planId,
            billingCycle: "MONTHLY",
            status: "TRIALING",
            // Price and limits are frozen at signup so later catalogue edits
            // never reprice or re-limit an existing subscriber.
            priceSnapshot: new Prisma.Decimal(input.priceSnapshot),
            currency: input.currency,
            limitsSnapshot: {
              version: 1,
              planCode: plan.code,
              maxWhatsappNumbers: plan.maxWhatsappNumbers,
              maxAiMessages: plan.maxAiMessages,
              maxProducts: plan.maxProducts,
            },
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          select: { id: true },
        });

        // Inside the transaction: an approval that commits without a trail is
        // the exact case the trail exists for.
        await tx.adminAuditLog.create({
          data: {
            adminUserId: input.actorId,
            tenantId: tenant.id,
            action: "registration.approve",
            resourceType: "registration",
            resourceId: input.registrationId,
            newValues: {
              tenantCode: tenant.tenantCode,
              slug,
              planCode: plan.code,
              ownerTenantUserId: owner.id,
              subscriptionId: subscription.id,
            },
          },
        });

        return {
          tenantId: tenant.id,
          tenantCode: tenant.tenantCode,
          subdomain: slug,
          // Derived, never stored: tenants has no URL column.
          websiteUrl: buildWebsiteUrl(slug, input.rootDomain, input.appUrl),
          databaseName,
          subscriptionId: subscription.id,
          ownerTenantUserId: owner.id,
        };
      });

      if (result === null) {
        return { ok: false, reason: "not-pending" };
      }

      if (result === DUPLICATE_OWNER) {
        return { ok: false, reason: "already-provisioned" };
      }

      if (result === MISSING_PLAN) {
        return { ok: false, reason: "failed" };
      }

      return { ok: true, tenant: result };
    } catch (error: unknown) {
      // The in-transaction read narrows the window; the constraint closes it.
      // A violation here means another approval won the race, which is a
      // duplicate rather than an unexplained failure.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        String(error.meta?.target ?? "").includes("owner_email")
      ) {
        return { ok: false, reason: "already-provisioned" };
      }

      console.error("Tenant provisioning failed and was rolled back.", error);
      return { ok: false, reason: "failed" };
    }
  }

  async setDatabaseStatus(
    tenantId: string,
    status: ProvisioningStatus,
    schemaVersion?: string,
  ): Promise<void> {
    await prisma.tenantDatabase.updateMany({
      where: { tenantId },
      data: {
        status: provisioningToPrisma[status],
        ...(schemaVersion === undefined ? {} : { schemaVersion }),
      },
    });
  }

  async findDatabaseTarget(tenantId: string): Promise<DatabaseTarget | null> {
    const row = await prisma.tenantDatabase.findUnique({
      where: { tenantId },
      select: { databaseName: true, status: true },
    });

    if (!row) return null;

    return {
      tenantId,
      databaseName: row.databaseName,
      status: provisioningMap[row.status],
    };
  }

  async setDatabaseConnection(
    tenantId: string,
    connection: DatabaseConnectionPointers,
  ): Promise<void> {
    await prisma.tenantDatabase.updateMany({
      where: { tenantId },
      data: {
        hostReference: connection.host,
        port: connection.port,
        usernameReference: connection.username,
        secretReference: connection.secretReference,
      },
    });
  }

  async findDatabasePointers(
    tenantId: string,
  ): Promise<DatabaseConnectionPointers | null> {
    const row = await prisma.tenantDatabase.findUnique({
      where: { tenantId },
      select: {
        hostReference: true,
        port: true,
        usernameReference: true,
        secretReference: true,
      },
    });

    if (!row) return null;

    return {
      host: row.hostReference,
      port: row.port,
      username: row.usernameReference,
      secretReference: row.secretReference,
    };
  }

  async rejectRegistration(input: RejectInput): Promise<boolean> {
    // Creates nothing. A rejection is a verdict on an application, so the only
    // rows it touches are the application itself and the audit trail.
    return prisma.$transaction(async (tx) => {
      const result = await tx.tenantRegistration.updateMany({
        where: { id: input.registrationId, status: { in: QUEUE_STATUSES } },
        data: {
          status: "REJECTED",
          rejectionReason: input.reason,
          reviewedAt: new Date(),
          reviewedBy: input.actorId,
        },
      });

      if (result.count === 0) return false;

      await tx.adminAuditLog.create({
        data: {
          adminUserId: input.actorId,
          action: "registration.reject",
          reason: input.reason,
          resourceType: "registration",
          resourceId: input.registrationId,
        },
      });

      return true;
    });
  }

  /**
   * Finds a free host label.
   *
   * The unique index is the real guard; this only avoids losing the
   * transaction to a predictable collision.
   */
  private async claimSubdomain(
    tx: Prisma.TransactionClient,
    base: string,
  ): Promise<string> {
    for (let attempt = 1; attempt <= MAX_LABEL_ATTEMPTS; attempt += 1) {
      const candidate = withSuffix(base, attempt);

      // A reserved slug is skipped, not rejected: the tenant site is served
      // from the application root, so "pricing" would lose to the marketing
      // route and simply never resolve.
      if (isReservedTenantSlug(candidate)) continue;

      const taken = await tx.tenant.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!taken) return candidate;
    }

    throw new Error(`No free subdomain for "${base}".`);
  }

  private async nextTenantCode(tx: Prisma.TransactionClient): Promise<string> {
    // Compared numerically, not as text. Ordering by tenantCode would put
    // "TEN-100000" below "TEN-99999" once the sequence passes five digits, and
    // the next code would start reissuing numbers already in use.
    const codes = await tx.tenant.findMany({
      where: { tenantCode: { startsWith: "TEN-" } },
      select: { tenantCode: true },
    });

    const highest = codes.reduce((max, row) => {
      const value = Number.parseInt(row.tenantCode.slice(4), 10);
      return Number.isFinite(value) && value > max ? value : max;
    }, 10_000);

    return formatTenantCode(highest + 1);
  }
}
