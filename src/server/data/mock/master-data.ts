import { PLATFORM_ADMIN_ROLES } from "@/constants/roles";
import type { PlatformAdmin } from "@/features/auth/types";
import type { SubscriptionPlan } from "@/features/plans/types";
import type { Subscription } from "@/features/subscriptions/types";
import type { Tenant } from "@/features/tenants/types";

export const mockAdmins: readonly PlatformAdmin[] = [
  {
    id: "admin_01",
    name: "Platform Administrator",
    email: "admin@example.com",
    role: PLATFORM_ADMIN_ROLES.SUPER_ADMIN,
    status: "active",
    lastSignedInAt: "2026-09-02T06:30:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-02T06:30:00.000Z",
  },
];

export const mockTenants: readonly Tenant[] = [
  {
    id: "tenant_01",
    name: "Northstar Commerce",
    slug: "northstar-commerce",
    status: "active",
    owner: {
      id: "owner_01",
      name: "Amina Rahman",
      email: "amina@northstar.example",
    },
    database: {
      tenantId: "tenant_01",
      databaseKey: "tenant_northstar_commerce",
      region: "ap-south-1",
      provisioningStatus: "ready",
      provisionedAt: "2026-08-10T09:00:00.000Z",
    },
    createdAt: "2026-08-10T08:45:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
  },
  {
    id: "tenant_02",
    name: "Demo Retail",
    slug: "demo-retail",
    status: "trial",
    owner: {
      id: "owner_02",
      name: "Demo Owner",
      email: "owner@demo.example",
    },
    database: {
      tenantId: "tenant_02",
      databaseKey: "tenant_demo_retail",
      region: "ap-south-1",
      provisioningStatus: "ready",
      provisionedAt: "2026-08-29T11:15:00.000Z",
    },
    createdAt: "2026-08-29T11:00:00.000Z",
    updatedAt: "2026-08-29T11:15:00.000Z",
  },
];

export const mockPlans: readonly SubscriptionPlan[] = [
  {
    id: "plan_growth",
    code: "growth",
    name: "Growth",
    description: "For growing businesses automating WhatsApp sales.",
    status: "active",
    monthlyPriceMinor: 4900,
    currency: "USD",
    limits: {
      monthlyMessages: 10_000,
      adminSeats: 5,
      whatsappNumbers: 2,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

export const mockSubscriptions: readonly Subscription[] = [
  {
    id: "subscription_01",
    tenantId: "tenant_01",
    planId: "plan_growth",
    status: "active",
    currentPeriodStart: "2026-08-10T09:00:00.000Z",
    currentPeriodEnd: "2026-09-10T09:00:00.000Z",
    cancelAtPeriodEnd: false,
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
  },
  {
    id: "subscription_02",
    tenantId: "tenant_02",
    planId: "plan_growth",
    status: "trialing",
    currentPeriodStart: "2026-08-29T11:15:00.000Z",
    currentPeriodEnd: "2026-09-12T11:15:00.000Z",
    cancelAtPeriodEnd: false,
    createdAt: "2026-08-29T11:15:00.000Z",
    updatedAt: "2026-08-29T11:15:00.000Z",
  },
];
