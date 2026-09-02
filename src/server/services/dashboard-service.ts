import "server-only";

import type { DashboardSummary } from "@/features/dashboard/types";
import type { AdminRepository } from "@/server/repositories/contracts/admin-repository";
import type { PlanRepository } from "@/server/repositories/contracts/plan-repository";
import type { SubscriptionRepository } from "@/server/repositories/contracts/subscription-repository";
import type { TenantRepository } from "@/server/repositories/contracts/tenant-repository";

interface DashboardServiceDependencies {
  readonly admins: AdminRepository;
  readonly plans: PlanRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly tenants: TenantRepository;
}

export class DashboardService {
  constructor(private readonly dependencies: DashboardServiceDependencies) {}

  async getSummary(): Promise<DashboardSummary> {
    const [tenantCount, activeSubscriptions, activePlans, activeAdmins] =
      await Promise.all([
        this.dependencies.tenants.count(),
        this.dependencies.subscriptions.countActive(),
        this.dependencies.plans.countActive(),
        this.dependencies.admins.countActive(),
      ]);

    return {
      metrics: [
        {
          label: "Tenants",
          value: tenantCount,
          description: "Registered platform tenants",
        },
        {
          label: "Active subscriptions",
          value: activeSubscriptions,
          description: "Active and trial subscriptions",
        },
        {
          label: "Active plans",
          value: activePlans,
          description: "Plans available for subscription",
        },
        {
          label: "Platform admins",
          value: activeAdmins,
          description: "Active back-office administrators",
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
