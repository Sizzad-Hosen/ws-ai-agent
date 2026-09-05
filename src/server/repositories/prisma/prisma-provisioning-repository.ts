import { Prisma } from "@prisma/client";

import {
  buildWebsiteUrl,
  deriveDatabaseName,
  deriveSubdomain,
  formatTenantCode,
  withSuffix,
} from "@/features/registrations/provisioning";
import { prisma } from "@/server/db/prisma";
import type {
  ProvisionInput,
  ProvisionOutcome,
  ProvisioningRepository,
} from "@/server/repositories/contracts/provisioning-repository";

/** Attempts at a free host label before giving up. */
const MAX_LABEL_ATTEMPTS = 25;

/** Sentinel returned from the transaction so the caller can tell the two
 * rollback reasons apart: a stale registration versus a duplicate owner. */
const DUPLICATE_OWNER = "duplicate-owner" as const;

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

    if (!registration || registration.status !== "PENDING_REVIEW") {
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
          where: { id: input.registrationId, status: "PENDING_REVIEW" },
          data: { status: "APPROVED" },
        });

        if (locked.count === 0) return null;

        // Re-checked inside the transaction. The owner's email is the closest
        // thing to an identity the ERD gives us, since tenants carry no
        // registration_id (§2.5 / D-02). A unique index on the column is what
        // actually makes this safe against two reviewers approving duplicate
        // registrations at the same moment; this read only turns that
        // constraint into an explanation instead of a raw violation.
        const existing = await tx.tenant.findUnique({
          where: { ownerEmail: registration.ownerEmail },
          select: { id: true },
        });

        if (existing) return DUPLICATE_OWNER;

        const subdomain = await this.claimSubdomain(tx, base);
        const databaseName = deriveDatabaseName(subdomain);
        const tenantCode = await this.nextTenantCode(tx);

        const tenant = await tx.tenant.create({
          data: {
            tenantCode,
            businessName: registration.businessName,
            ownerName: registration.ownerName,
            ownerEmail: registration.ownerEmail,
            ownerPhone: registration.ownerPhone,
            industry: registration.industry,
            region: registration.region,
            subdomain,
            websiteUrl: buildWebsiteUrl(subdomain, input.rootDomain),
            // Trial rather than active: the workspace is not usable until its
            // database is actually provisioned.
            approvalStatus: "TRIAL",
            database: {
              create: {
                databaseName,
                ...connectionReferences(subdomain, input.region),
                status: "PENDING",
                schemaVersion: "0",
                region: input.region,
              },
            },
          },
          select: {
            id: true,
            tenantCode: true,
            subdomain: true,
            websiteUrl: true,
          },
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
            // Price is frozen at signup so later catalogue edits never reprice
            // an existing subscriber.
            priceSnapshot: new Prisma.Decimal(input.priceSnapshot),
            currency: input.currency,
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          select: { id: true },
        });

        return {
          tenantId: tenant.id,
          tenantCode: tenant.tenantCode,
          subdomain,
          websiteUrl: tenant.websiteUrl,
          databaseName,
          subscriptionId: subscription.id,
        };
      });

      if (result === null) {
        return { ok: false, reason: "not-pending" };
      }

      if (result === DUPLICATE_OWNER) {
        return { ok: false, reason: "already-provisioned" };
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

  async rejectRegistration(registrationId: string): Promise<boolean> {
    const result = await prisma.tenantRegistration.updateMany({
      where: { id: registrationId, status: "PENDING_REVIEW" },
      data: { status: "REJECTED" },
    });

    return result.count > 0;
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
      const taken = await tx.tenant.findUnique({
        where: { subdomain: candidate },
        select: { id: true },
      });

      if (!taken) return candidate;
    }

    throw new Error(`No free subdomain for "${base}".`);
  }

  private async nextTenantCode(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.tenant.findFirst({
      where: { tenantCode: { startsWith: "TEN-" } },
      orderBy: { tenantCode: "desc" },
      select: { tenantCode: true },
    });

    const current = Number.parseInt(
      latest?.tenantCode.replace("TEN-", "") ?? "",
      10,
    );

    return formatTenantCode((Number.isFinite(current) ? current : 10_000) + 1);
  }
}
