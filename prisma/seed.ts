import "dotenv/config";

import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AdminStatus,
  MembershipRole,
  MembershipStatus,
  PlanStatus,
  PlatformAdminRole,
  PrismaClient,
  ProvisioningStatus,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the development database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function requiredSeedValue(
  name: "BO_SEED_ADMIN_EMAIL" | "BO_SEED_ADMIN_PASSWORD",
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to seed the development database.`);
  }

  return value;
}

async function main(): Promise<void> {
  const adminEmail = requiredSeedValue("BO_SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredSeedValue("BO_SEED_ADMIN_PASSWORD");
  const passwordHash = await hash(adminPassword, 12);

  const admin = await prisma.platformAdmin.upsert({
    where: { email: adminEmail },
    update: {
      name: "Platform Administrator",
      passwordHash,
      role: PlatformAdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    },
    create: {
      name: "Platform Administrator",
      email: adminEmail,
      passwordHash,
      role: PlatformAdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    },
  });

  const plan = await prisma.subscriptionPlan.upsert({
    where: { code: "growth" },
    update: {},
    create: {
      code: "growth",
      name: "Growth",
      description: "For growing businesses automating WhatsApp sales.",
      status: PlanStatus.ACTIVE,
      monthlyPriceMinor: 4900,
      currency: "USD",
      monthlyMessageLimit: 10_000,
      adminSeatLimit: 5,
      whatsappNumberLimit: 2,
    },
  });

  const owner = await prisma.tenantUser.upsert({
    where: { email: "amina@northstar.example" },
    update: {},
    create: {
      name: "Amina Rahman",
      email: "amina@northstar.example",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "northstar-commerce" },
    update: {},
    create: {
      name: "Northstar Commerce",
      slug: "northstar-commerce",
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    update: { role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.tenantDatabaseRegistry.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      databaseKey: "tenant_northstar_commerce",
      secretReference: "secrets/tenants/northstar/database-url",
      region: "ap-south-1",
      provisioningStatus: ProvisioningStatus.READY,
      provisionedAt: new Date(),
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id, status: SubscriptionStatus.ACTIVE },
  });

  if (!existingSubscription) {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  await prisma.platformConfiguration.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      maintenanceMode: false,
      supportEmail: "support@wa-agent.local",
    },
  });

  await prisma.platformAiSettings.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      defaultProviderKey: "unconfigured",
      defaultModelKey: "unconfigured",
      isEnabled: false,
    },
  });

  await prisma.platformAuditLog.upsert({
    where: { id: "audit_development_seed" },
    update: {
      actorAdminId: admin.id,
      occurredAt: new Date(),
      metadata: { tenantId: tenant.id, planId: plan.id },
    },
    create: {
      id: "audit_development_seed",
      actorAdminId: admin.id,
      action: "development.seed.completed",
      entityType: "Platform",
      entityId: "platform",
      metadata: { tenantId: tenant.id, planId: plan.id },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
