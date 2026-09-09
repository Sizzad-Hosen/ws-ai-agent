/**
 * One approved tenant, so the back office has something to render.
 *
 * This is the only fixture business data in the seed. It exists because the
 * tenants list, the tenant detail screen and the subscription screen are all
 * empty without it, and an empty screen cannot be reviewed.
 *
 * It also exercises the circular foreign key: the tenant row is written first
 * with a null owner, then the owner row, then the tenant is pointed at it.
 * Provisioning does the same three steps in one transaction.
 */
import {
  BillingCycle,
  SubscriptionStatus,
  TenantApprovalStatus,
  TenantDatabaseMigrationState,
  TenantDatabaseStatus,
  TenantDatabaseTier,
  TenantStatus,
  TenantUserRole,
  TenantUserStatus,
  type Plan,
} from "@prisma/client";

import { prisma } from "./client";
import { daysAgo } from "./helpers";

const TENANT_CODE = "TEN-0001";
const OWNER_EMAIL = "owner@northwindgrocers.example";

export async function seedTenant(
  plan: Plan,
  approvedBy: string,
): Promise<{ readonly id: string }> {
  const approvedAt = daysAgo(21);

  const base = {
    slug: "northwind",
    businessName: "Northwind Grocers",
    industry: "Grocery",
    businessRegion: "Dhaka",
    countryCode: "BD",
    timezone: "Asia/Dhaka",
    defaultLocale: "en",
    currency: "BDT",
    ownerName: "Ayesha Rahman",
    ownerEmail: OWNER_EMAIL,
    ownerPhone: "+8801700000001",
    approvalStatus: TenantApprovalStatus.APPROVED,
    approvedAt,
    approvedBy,
    status: TenantStatus.ACTIVE,
  };

  const tenant = await prisma.tenant.upsert({
    where: { tenantCode: TENANT_CODE },
    update: base,
    create: { tenantCode: TENANT_CODE, ...base },
    select: { id: true },
  });

  const databaseFields = {
    tier: TenantDatabaseTier.SHARED,
    hostReference: "secret://tenant-db/shared-01/host",
    port: 5432,
    databaseName: "ordivex_tenant_northwind",
    schemaName: "public",
    usernameReference: "secret://tenant-db/northwind/username",
    secretReference: "secret://tenant-db/northwind/password",
    region: "ap-south-1",
    schemaVersion: "001",
    migrationState: TenantDatabaseMigrationState.APPLIED,
    status: TenantDatabaseStatus.READY,
    lastBackupAt: daysAgo(1),
  };

  await prisma.tenantDatabase.upsert({
    where: { tenantId: tenant.id },
    update: databaseFields,
    create: { tenantId: tenant.id, ...databaseFields },
  });

  const ownerFields = {
    name: "Ayesha Rahman",
    phone: "+8801700000001",
    role: TenantUserRole.OWNER,
    locale: "en",
    status: TenantUserStatus.ACTIVE,
    isOwner: true,
    emailVerifiedAt: approvedAt,
  };

  const owner = await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: OWNER_EMAIL } },
    update: ownerFields,
    create: { tenantId: tenant.id, email: OWNER_EMAIL, ...ownerFields },
    select: { id: true },
  });

  // Third step of the circular pair, once both rows exist.
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ownerTenantUserId: owner.id },
  });

  // `uq_one_live_subscription` allows one trialing, active or past_due row per
  // tenant, so this looks for an existing live row instead of upserting.
  const live = await prisma.subscription.findFirst({
    where: {
      tenantId: tenant.id,
      status: {
        in: [
          SubscriptionStatus.TRIALING,
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
        ],
      },
    },
    select: { id: true },
  });

  if (live === null) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        // Snapshots, not live reads. Editing the plan must not change these.
        priceSnapshot: plan.monthlyPrice ?? "0.00",
        currency: plan.currency,
        limitsSnapshot: {
          maxWhatsappNumbers: plan.maxWhatsappNumbers,
          maxAiMessages: plan.maxAiMessages,
          maxProducts: plan.maxProducts,
        },
        startedAt: approvedAt,
        currentPeriodStart: daysAgo(7),
        currentPeriodEnd: daysAgo(-23),
      },
    });
  }

  return tenant;
}
