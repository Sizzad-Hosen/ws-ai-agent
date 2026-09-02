import "server-only";

import { PrismaAdminRepository } from "./prisma/prisma-admin-repository";
import { PrismaPlanRepository } from "./prisma/prisma-plan-repository";
import { PrismaSessionRepository } from "./prisma/prisma-session-repository";
import { PrismaSubscriptionRepository } from "./prisma/prisma-subscription-repository";
import { PrismaTenantRepository } from "./prisma/prisma-tenant-repository";

export const repositories = {
  admins: new PrismaAdminRepository(),
  plans: new PrismaPlanRepository(),
  sessions: new PrismaSessionRepository(),
  subscriptions: new PrismaSubscriptionRepository(),
  tenants: new PrismaTenantRepository(),
} as const;
