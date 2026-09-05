/** Tenants, their provisioned databases, subscriptions and invoices. */

import {
  BillingCycle,
  InvoiceStatus,
  SubscriptionStatus,
  TenantApprovalStatus,
  TenantDatabaseStatus,
} from "@prisma/client";
import { prisma } from "./client";
import { daysAgo, daysAhead } from "./helpers";

interface TenantSeed {
  readonly tenantCode: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly industry: string;
  readonly region: string;
  readonly approvalStatus: TenantApprovalStatus;
  readonly planCode: "starter" | "business" | "enterprise";
  readonly billingCycle: BillingCycle;
  readonly priceSnapshot: string;
  readonly databaseName: string;
  readonly databaseStatus: TenantDatabaseStatus;
  readonly instanceHost: string;
  readonly ageDays: number;
}

export const TENANT_SEEDS: readonly TenantSeed[] = [
  {
    tenantCode: "TEN-10241",
    businessName: "Urban Style BD",
    ownerName: "Rahim",
    ownerEmail: "rahim@urbanstyle.bd",
    ownerPhone: "+1 234 567 890",
    industry: "Fashion & Retail",
    region: "US-East-1",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "enterprise",
    billingCycle: BillingCycle.ANNUAL,
    priceSnapshot: "1250.00",
    databaseName: "sp_tenant_urban_style",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-01",
    ageDays: 680,
  },
  {
    tenantCode: "TEN-10242",
    businessName: "Book Haven",
    ownerName: "Sadia Islam",
    ownerEmail: "info@bookhaven.com",
    ownerPhone: "+1 234 567 891",
    industry: "Retail",
    region: "US-East-1",
    approvalStatus: TenantApprovalStatus.TRIAL,
    planCode: "business",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "0.00",
    databaseName: "sp_tenant_book_haven",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-01",
    ageDays: 21,
  },
  {
    tenantCode: "TEN-10243",
    businessName: "Tech World",
    ownerName: "Arif Hossain",
    ownerEmail: "admin@techworld.net",
    ownerPhone: "+1 234 567 892",
    industry: "Electronics",
    region: "EU-West-1",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "business",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "299.00",
    databaseName: "sp_tenant_tech_world",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-eu-02",
    ageDays: 140,
  },
  {
    tenantCode: "TEN-10244",
    businessName: "Beauty Corner",
    ownerName: "Mim Akter",
    ownerEmail: "hello@beautycorner.co",
    ownerPhone: "+1 234 567 893",
    industry: "Beauty & Wellness",
    region: "US-East-1",
    approvalStatus: TenantApprovalStatus.SUSPENDED,
    planCode: "starter",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "49.00",
    databaseName: "sp_tenant_beauty_corner",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-03",
    ageDays: 200,
  },
  {
    tenantCode: "TEN-10245",
    businessName: "Fresh Basket",
    ownerName: "Tanvir Ahmed",
    ownerEmail: "ops@freshbasket.com",
    ownerPhone: "+1 234 567 894",
    industry: "Grocery",
    region: "US-East-1",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "enterprise",
    billingCycle: BillingCycle.ANNUAL,
    priceSnapshot: "2500.00",
    databaseName: "sp_tenant_fresh_basket",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-01",
    ageDays: 320,
  },
  {
    tenantCode: "TEN-10246",
    businessName: "Acme Corp",
    ownerName: "Dana Whitfield",
    ownerEmail: "ops@acme.com",
    ownerPhone: "+1 555 019 2834",
    industry: "Manufacturing",
    region: "US-East-1",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "enterprise",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "1850.00",
    databaseName: "sp_tenant_acme_corp",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-02",
    ageDays: 410,
  },
  {
    tenantCode: "TEN-10247",
    businessName: "Globex Inc",
    ownerName: "Marco Ruiz",
    ownerEmail: "sales@globex.mx",
    ownerPhone: "+52 55 1234 5678",
    industry: "Logistics",
    region: "LatAm-1",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "business",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "920.00",
    databaseName: "sp_tenant_globex",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-mx-01",
    ageDays: 260,
  },
  {
    tenantCode: "TEN-10248",
    businessName: "Stark Industries",
    ownerName: "Pepper Vance",
    ownerEmail: "pr@stark.io",
    ownerPhone: "+1 800 555 0099",
    industry: "Technology",
    region: "US-West-2",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "enterprise",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "1420.00",
    databaseName: "sp_tenant_stark",
    databaseStatus: TenantDatabaseStatus.READY,
    instanceHost: "db-us-04",
    ageDays: 180,
  },
  {
    tenantCode: "TEN-10249",
    businessName: "Wayne Ent.",
    ownerName: "Lucius Reed",
    ownerEmail: "logistics@wayne.co.uk",
    ownerPhone: "+44 20 7123 4567",
    industry: "Logistics",
    region: "EU-West-2",
    approvalStatus: TenantApprovalStatus.ACTIVE,
    planCode: "business",
    billingCycle: BillingCycle.MONTHLY,
    priceSnapshot: "299.00",
    databaseName: "sp_tenant_wayne",
    // Exercises the provisioning-in-progress branch on the tenant detail page.
    databaseStatus: TenantDatabaseStatus.PROVISIONING,
    instanceHost: "db-eu-03",
    ageDays: 95,
  },
];

/**
 * Host label for a tenant, derived from its business name for seed data only.
 *
 * Real tenants get an explicitly assigned subdomain: deriving one from a name
 * cannot survive a rename and cannot guarantee uniqueness. Collisions here
 * would surface as a unique-constraint failure rather than silently routing two
 * tenants to one host.
 */
function seedSubdomain(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export async function seedTenants(
  planIds: Readonly<Record<string, string>>,
): Promise<void> {
  let invoiceCounter = 1;

  for (const seed of TENANT_SEEDS) {
    const tenant = await prisma.tenant.upsert({
      where: { tenantCode: seed.tenantCode },
      update: { subdomain: seedSubdomain(seed.businessName) },
      create: {
        tenantCode: seed.tenantCode,
        businessName: seed.businessName,
        subdomain: seedSubdomain(seed.businessName),
        ownerName: seed.ownerName,
        ownerEmail: seed.ownerEmail,
        ownerPhone: seed.ownerPhone,
        industry: seed.industry,
        region: seed.region,
        approvalStatus: seed.approvalStatus,
        createdAt: daysAgo(seed.ageDays),
      },
    });

    await prisma.tenantDatabase.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        databaseName: seed.databaseName,
        // Pointers into the secret manager, never credentials.
        hostReference: `secret://tenant-db/${seed.databaseName}/host`,
        port: 5432,
        usernameReference: `secret://tenant-db/${seed.databaseName}/username`,
        secretReference: `secret://tenant-db/${seed.databaseName}/password`,
        status: seed.databaseStatus,
        schemaVersion: "2026.08.1",
        region: seed.region,
      },
    });

    const existing = await prisma.subscription.findFirst({
      where: { tenantId: tenant.id },
    });

    const subscription =
      existing ??
      (await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: planIds[seed.planCode],
          billingCycle: seed.billingCycle,
          status:
            seed.approvalStatus === TenantApprovalStatus.TRIAL
              ? SubscriptionStatus.TRIALING
              : seed.approvalStatus === TenantApprovalStatus.SUSPENDED
                ? SubscriptionStatus.PAST_DUE
                : SubscriptionStatus.ACTIVE,
          priceSnapshot: seed.priceSnapshot,
          currency: "USD",
          startedAt: daysAgo(seed.ageDays),
          currentPeriodStart: daysAgo(12),
          currentPeriodEnd: daysAhead(18),
        },
      }));

    const subtotal = Number(seed.priceSnapshot);
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const paid = seed.approvalStatus !== TenantApprovalStatus.SUSPENDED;

    await prisma.invoice.upsert({
      where: {
        invoiceNumber: `INV-2026-${String(invoiceCounter).padStart(5, "0")}`,
      },
      update: {},
      create: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        invoiceNumber: `INV-2026-${String(invoiceCounter).padStart(5, "0")}`,
        status: paid ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: (subtotal + tax).toFixed(2),
        currency: "USD",
        dueAt: daysAhead(6),
        paidAt: paid ? daysAgo(6) : null,
      },
    });

    invoiceCounter += 1;
  }
}
