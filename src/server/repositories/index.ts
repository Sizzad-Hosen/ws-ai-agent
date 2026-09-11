import "server-only";

import type { ActivityRepository } from "./contracts/activity-repository";
import type { AdminRepository } from "./contracts/admin-repository";
import type { AiConfigurationRepository } from "./contracts/ai-configuration-repository";
import type { MessageRepository } from "./contracts/message-repository";
import type { PlanRepository } from "./contracts/plan-repository";
import type { ProvisioningRepository } from "./contracts/provisioning-repository";
import type { RegistrationRepository } from "./contracts/registration-repository";
import type { SessionRepository } from "./contracts/session-repository";
import type { SiteSettingsRepository } from "./contracts/site-settings-repository";
import type { SubscriptionRepository } from "./contracts/subscription-repository";
import type { TenantRepository } from "./contracts/tenant-repository";
import type { UsageRepository } from "./contracts/usage-repository";
import type { WhatsappRepository } from "./contracts/whatsapp-repository";
import { PrismaAdminRepository } from "./prisma/prisma-admin-repository";
import { PrismaAiConfigurationRepository } from "./prisma/prisma-ai-configuration-repository";
import { PrismaPlanRepository } from "./prisma/prisma-plan-repository";
import { PrismaProvisioningRepository } from "./prisma/prisma-provisioning-repository";
import { PrismaRegistrationRepository } from "./prisma/prisma-registration-repository";
import { PrismaSessionRepository } from "./prisma/prisma-session-repository";
import { PrismaSiteSettingsRepository } from "./prisma/prisma-site-settings-repository";
import { PrismaSubscriptionRepository } from "./prisma/prisma-subscription-repository";
import { PrismaTenantRepository } from "./prisma/prisma-tenant-repository";
import {
  UnavailableActivityRepository,
  UnavailableMessageRepository,
  UnavailableUsageRepository,
  UnavailableWhatsappRepository,
} from "./unavailable";

/** The ports the application depends on, independent of any adapter. */
export interface Repositories {
  readonly admins: AdminRepository;
  readonly aiConfiguration: AiConfigurationRepository;
  readonly plans: PlanRepository;
  readonly provisioning: ProvisioningRepository;
  readonly registrations: RegistrationRepository;
  readonly sessions: SessionRepository;
  readonly siteSettings: SiteSettingsRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly tenants: TenantRepository;
  readonly activity: ActivityRepository;
  readonly messages: MessageRepository;
  readonly usage: UsageRepository;
  readonly whatsapp: WhatsappRepository;
}

/**
 * Adapter wiring.
 *
 * Every port the master ERD models reads from Postgres. The remaining four
 * report absence because they have no tables at all — see §2.2 / §2.3 and
 * decisions D-10 / D-11 in docs/IMPLEMENTATION_PLAN.md. There is no fixture
 * data anywhere in the application.
 *
 * Typed as `Repositories` so call sites bind to the port and never to the
 * adapter that happens to be wired in today.
 */
export const repositories: Repositories = {
  admins: new PrismaAdminRepository(),
  aiConfiguration: new PrismaAiConfigurationRepository(),
  plans: new PrismaPlanRepository(),
  provisioning: new PrismaProvisioningRepository(),
  registrations: new PrismaRegistrationRepository(),
  sessions: new PrismaSessionRepository(),
  siteSettings: new PrismaSiteSettingsRepository(),
  subscriptions: new PrismaSubscriptionRepository(),
  tenants: new PrismaTenantRepository(),

  activity: new UnavailableActivityRepository(),
  messages: new UnavailableMessageRepository(),
  usage: new UnavailableUsageRepository(),
  whatsapp: new UnavailableWhatsappRepository(),
};
