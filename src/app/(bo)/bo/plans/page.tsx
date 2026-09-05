import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { PlanCard } from "@/features/plans/components/plan-card";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plan Management",
};

export default async function PlansPage() {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.PLANS_READ);
  const plans = await repositories.plans.findAll();
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.PLANS_MANAGE,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Commercial", href: ROUTES.bo.plans },
          { label: "Plan Management" },
        ]}
        title="Plan Management"
        description="Configure pricing tiers, resource limits, and feature availability."
        actions={
          canManage ? (
            <Link
              href={ROUTES.bo.planCreate}
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              <CirclePlus className="size-4" aria-hidden="true" />
              Create Plan
            </Link>
          ) : null
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No plans configured"
          description="Create a plan to make subscriptions available to new tenants."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((item) => (
            <PlanCard key={item.plan.id} item={item} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
