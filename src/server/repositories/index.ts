import "server-only";

import { PrismaAdminRepository } from "./prisma/prisma-admin-repository";
import { PrismaAiConfigurationRepository } from "./prisma/prisma-ai-configuration-repository";
import { PrismaPlanRepository } from "./prisma/prisma-plan-repository";
import { PrismaRegistrationRepository } from "./prisma/prisma-registration-repository";
import { PrismaSessionRepository } from "./prisma/prisma-session-repository";
import { PrismaSubscriptionRepository } from "./prisma/prisma-subscription-repository";
import { PrismaTenantRepository } from "./prisma/prisma-tenant-repository";
import {
  UnavailableActivityRepository,
  UnavailableMessageRepository,
  UnavailableUsageRepository,
  UnavailableWhatsappRepository,
} from "./unavailable";

/**
 * Adapter wiring.
 *
 * Every port the master ERD models reads from Postgres. The remaining four
 * report absence because they have no tables at all — see §2.2 / §2.3 and
 * decisions D-10 / D-11 in docs/IMPLEMENTATION_PLAN.md. There is no fixture
 * data anywhere in the application.
 */
export const repositories = {
  admins: new PrismaAdminRepository(),
  aiConfiguration: new PrismaAiConfigurationRepository(),
  plans: new PrismaPlanRepository(),
  registrations: new PrismaRegistrationRepository(),
  sessions: new PrismaSessionRepository(),
  subscriptions: new PrismaSubscriptionRepository(),
  tenants: new PrismaTenantRepository(),

  activity: new UnavailableActivityRepository(),
  messages: new UnavailableMessageRepository(),
  usage: new UnavailableUsageRepository(),
  whatsapp: new UnavailableWhatsappRepository(),
} as const;
