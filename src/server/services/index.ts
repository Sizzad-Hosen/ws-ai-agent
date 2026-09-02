import "server-only";

import { repositories } from "@/server/repositories";

import { DashboardService } from "./dashboard-service";
import { BoAuthService } from "@/server/auth/bo-auth-service";

export const services = {
  auth: new BoAuthService(repositories),
  dashboard: new DashboardService(repositories),
} as const;
