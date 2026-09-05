import "server-only";

import { BoAuthService } from "@/server/auth/bo-auth-service";
import { repositories } from "@/server/repositories";

import { DashboardService } from "./dashboard-service";

export const services = {
  auth: new BoAuthService({
    admins: repositories.admins,
    sessions: repositories.sessions,
  }),
  dashboard: new DashboardService({
    activity: repositories.activity,
    subscriptions: repositories.subscriptions,
    tenants: repositories.tenants,
    usage: repositories.usage,
    whatsapp: repositories.whatsapp,
  }),
} as const;
