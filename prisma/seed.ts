import "dotenv/config";

import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AdminRole,
  AdminStatus,
  AiProviderStatus,
  BillingCycle,
  InvoiceStatus,
  PrismaClient,
  PublicPageStatus,
  RegistrationCheckStatus,
  RegistrationCheckType,
  RegistrationStatus,
  SubscriptionStatus,
  TenantApprovalStatus,
  TenantDatabaseStatus,
} from "@prisma/client";

/**
 * Development seed for the master database.
 *
 * Every write is an upsert keyed on a natural unique column, so running the
 * seed repeatedly converges rather than duplicating.
 */

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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysAhead(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Mirrors src/constants/permissions.ts. */
const PERMISSION_CODES = [
  ["dashboard:read", "View the platform overview"],
  ["tenants:read", "View tenants and registrations"],
  ["tenants:manage", "Approve, suspend and edit tenants"],
  ["plans:read", "View the plan catalogue"],
  ["plans:manage", "Create and edit plans"],
  ["subscriptions:read", "View subscriptions"],
  ["subscriptions:manage", "Change and cancel subscriptions"],
  ["ai_settings:read", "View AI provider configuration"],
  ["ai_settings:manage", "Change AI provider configuration"],
  ["usage:read", "View AI usage and cost reporting"],
  ["whatsapp:read", "View WhatsApp account health"],
  ["whatsapp:manage", "Reconnect WhatsApp accounts"],
  ["messages:read", "View the message log"],
  ["billing:read", "View invoices and revenue"],
  ["settings:manage", "Change platform settings"],
  ["audit_logs:read", "Read the audit trail"],
] as const;

/** Mirrors ROLE_PERMISSIONS in src/features/auth/permissions.ts. */
const ROLE_DEFINITIONS: readonly {
  name: string;
  description: string;
  permissions: readonly string[];
}[] = [
  {
    name: "SUPER_ADMIN",
    description: "Unrestricted access to every back-office capability.",
    permissions: PERMISSION_CODES.map(([code]) => code),
  },
  {
    name: "ADMIN",
    description: "Full operational access without revenue reporting.",
    permissions: PERMISSION_CODES.map(([code]) => code).filter(
      (code) => code !== "billing:read",
    ),
  },
  {
    name: "SUPPORT",
    description: "Read-only access for customer support.",
    permissions: [
      "dashboard:read",
      "tenants:read",
      "plans:read",
      "subscriptions:read",
      "whatsapp:read",
      "messages:read",
      "audit_logs:read",
    ],
  },
  {
    name: "FINANCE",
    description: "Revenue, subscription and usage reporting.",
    permissions: [
      "dashboard:read",
      "tenants:read",
      "plans:read",
      "subscriptions:read",
      "subscriptions:manage",
      "usage:read",
      "billing:read",
    ],
  },
];

async function seedRbac(): Promise<void> {
  for (const [code, description] of PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.adminRoleRecord.upsert({
      where: { name: definition.name },
      update: { description: definition.description },
      create: { name: definition.name, description: definition.description },
    });

    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...definition.permissions] } },
    });

    // Replace the grant set so removing a permission from the definition
    // actually revokes it.
    await prisma.adminRolePermission.deleteMany({
      where: { roleId: role.id },
    });
    await prisma.adminRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}

async function seedPlans() {
  const starter = await prisma.plan.upsert({
    where: { code: "starter" },
    update: {},
    create: {
      code: "starter",
      name: "Starter",
      description: "For small teams testing WhatsApp automation.",
      monthlyPrice: "99.00",
      annualPrice: "950.00",
      currency: "USD",
      sortOrder: 1,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          { key: "analytics", label: "Analytics", enabled: false },
          { key: "human_handoff", label: "Human Handoff", enabled: false },
        ],
        highlights: ["Knowledge Base", "Email support"],
        accentColor: "#e2e8f0",
      },
    },
  });

  const business = await prisma.plan.upsert({
    where: { code: "business" },
    update: {},
    create: {
      code: "business",
      name: "Business",
      description: "For growing businesses automating WhatsApp sales.",
      monthlyPrice: "299.00",
      annualPrice: "2870.00",
      currency: "USD",
      sortOrder: 2,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          { key: "analytics", label: "Analytics", enabled: true },
          { key: "human_handoff", label: "Human Handoff", enabled: true },
        ],
        highlights: ["Knowledge Base", "Analytics", "Human Handoff"],
        accentColor: "#d1fae5",
        popular: true,
      },
    },
  });

  const enterprise = await prisma.plan.upsert({
    where: { code: "enterprise" },
    update: {},
    create: {
      code: "enterprise",
      name: "Enterprise",
      description:
        "Full-featured tier for large organizations requiring advanced AI capabilities and dedicated support.",
      // Null price renders as "Custom" on the plan cards.
      monthlyPrice: null,
      annualPrice: null,
      currency: "USD",
      sortOrder: 3,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          {
            key: "analytics_advanced",
            label: "Analytics (Advanced)",
            enabled: true,
          },
          {
            key: "white_label_handoff",
            label: "White-label Handoff",
            enabled: true,
          },
        ],
        highlights: [
          "Unlimited AI Configurations",
          "Dedicated Account Manager",
          "24/7 Priority Support",
          "Custom Model Fine-tuning",
          "Advanced Audit Logging",
        ],
        accentColor: "#dbeafe",
      },
    },
  });

  return { starter, business, enterprise };
}

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

const TENANT_SEEDS: readonly TenantSeed[] = [
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

async function seedTenants(
  planIds: Readonly<Record<string, string>>,
): Promise<void> {
  let invoiceCounter = 1;

  for (const seed of TENANT_SEEDS) {
    const tenant = await prisma.tenant.upsert({
      where: { tenantCode: seed.tenantCode },
      update: {},
      create: {
        tenantCode: seed.tenantCode,
        businessName: seed.businessName,
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

async function seedRegistrations(
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

async function seedAi(): Promise<void> {
  const openai = await prisma.aiProvider.upsert({
    where: { name: "OpenAI" },
    update: {},
    create: { name: "OpenAI", status: AiProviderStatus.ACTIVE },
  });
  const anthropic = await prisma.aiProvider.upsert({
    where: { name: "Anthropic" },
    update: {},
    create: { name: "Anthropic", status: AiProviderStatus.ACTIVE },
  });
  await prisma.aiProvider.upsert({
    where: { name: "Google" },
    update: {},
    create: { name: "Google", status: AiProviderStatus.INACTIVE },
  });

  const models = [
    {
      providerId: openai.id,
      modelName: "gpt-4o",
      capabilities: ["chat", "tools", "vision"],
    },
    {
      providerId: openai.id,
      modelName: "gpt-4o-mini",
      capabilities: ["chat", "tools"],
    },
    {
      providerId: anthropic.id,
      modelName: "claude-sonnet-5",
      capabilities: ["chat", "tools", "vision"],
    },
  ] as const;

  for (const model of models) {
    await prisma.aiModel.upsert({
      where: {
        providerId_modelName: {
          providerId: model.providerId,
          modelName: model.modelName,
        },
      },
      update: {},
      create: {
        providerId: model.providerId,
        modelName: model.modelName,
        capabilities: [...model.capabilities],
        isActive: true,
      },
    });
  }

  const defaultModel = await prisma.aiModel.findFirstOrThrow({
    where: { providerId: openai.id, modelName: "gpt-4o" },
  });

  const activeConfiguration = await prisma.platformAiConfiguration.findFirst({
    where: { isActive: true },
  });

  if (!activeConfiguration) {
    await prisma.platformAiConfiguration.create({
      data: {
        providerId: openai.id,
        modelId: defaultModel.id,
        // A pointer into the secret manager. The key itself never lives here.
        secretReference: "secret://platform-ai/openai/api-key",
        isActive: true,
        globalTokenLimit: BigInt(1_000_000),
        defaultTenantTokenLimit: BigInt(50_000),
        warningThresholdPercent: 80,
      },
    });
  }
}

async function seedPublicSite(): Promise<void> {
  const pages = [
    {
      slug: "home",
      title: "Sell on WhatsApp while you sleep",
      content:
        "SellPilot AI answers every lead on WhatsApp, qualifies them, and closes orders automatically.",
    },
    {
      slug: "how-it-works",
      title: "How it works",
      content:
        "Connect your WhatsApp Business number, train the agent on your catalogue, and let it handle conversations end to end.",
    },
    {
      slug: "demo",
      title: "See the automation flow",
      content:
        "A guided walkthrough of a real conversation from first message to confirmed order.",
    },
    {
      slug: "categories",
      title: "Built for your category",
      content:
        "Retail, grocery, electronics, beauty and professional services, with playbooks for each.",
    },
    {
      slug: "pricing",
      title: "Pricing and use cases",
      content:
        "Starter, Business and Enterprise tiers sized by AI message volume, WhatsApp numbers and team seats.",
    },
    {
      slug: "about",
      title: "About us",
      content:
        "We build reliable AI sales infrastructure for businesses that live in WhatsApp.",
    },
  ] as const;

  for (const page of pages) {
    await prisma.publicPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: PublicPageStatus.PUBLISHED,
        publishedAt: daysAgo(30),
        seoMetadata: {
          title: `${page.title} | SellPilot AI`,
          description: page.content.slice(0, 155),
        },
      },
    });
  }

  const faqs = [
    {
      question: "Do I need a WhatsApp Business API account?",
      answer:
        "Yes. We guide you through Meta business verification during onboarding and connect the number for you.",
    },
    {
      question: "How long does setup take?",
      answer:
        "Most businesses are live within a day once Meta approves the number.",
    },
    {
      question: "Can a human take over a conversation?",
      answer:
        "Yes. Human handoff is available on Business and Enterprise plans, and the agent hands over with full context.",
    },
    {
      question: "What happens if I exceed my AI message limit?",
      answer:
        "You are warned as you approach the limit and can upgrade at any time; conversations are never dropped silently.",
    },
    {
      question: "Where is my data stored?",
      answer:
        "Each business gets a dedicated database in the region you choose at signup.",
    },
  ] as const;

  for (const [index, faq] of faqs.entries()) {
    const existing = await prisma.publicFaq.findFirst({
      where: { question: faq.question },
    });

    if (!existing) {
      await prisma.publicFaq.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          sortOrder: index + 1,
          isActive: true,
        },
      });
    }
  }

  const settings = [
    { siteKey: "brand", value: { name: "SellPilot AI", primary: "#10B981" } },
    {
      siteKey: "contact",
      value: {
        supportEmail: "support@sellpilot.ai",
        salesEmail: "sales@sellpilot.ai",
      },
    },
    {
      siteKey: "announcement",
      value: { enabled: false, message: "" },
    },
  ] as const;

  for (const setting of settings) {
    await prisma.publicSiteSetting.upsert({
      where: { siteKey: setting.siteKey },
      update: {},
      create: { siteKey: setting.siteKey, value: setting.value },
    });
  }
}

async function main(): Promise<void> {
  const adminEmail = requiredSeedValue("BO_SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredSeedValue("BO_SEED_ADMIN_PASSWORD");
  const passwordHash = await hash(adminPassword, 12);

  await seedRbac();

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      name: "Platform Administrator",
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    },
    create: {
      name: "Platform Administrator",
      email: adminEmail,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    },
  });

  const plans = await seedPlans();
  const planIds = {
    starter: plans.starter.id,
    business: plans.business.id,
    enterprise: plans.enterprise.id,
  };

  await seedTenants(planIds);
  await seedRegistrations(planIds, admin.id);
  await seedAi();
  await seedPublicSite();

  console.info(
    `Seed complete: ${TENANT_SEEDS.length} tenants, 3 plans, 3 registrations, AI configuration and public-site content.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
