import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { PlanForm } from "@/features/plans/components/plan-form";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "Edit Plan",
};

export default async function EditPlanPage({
  params,
}: PageProps<"/bo/plans/[id]/edit">) {
  await requirePermission(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  const { id } = await params;
  const plan = await repositories.plans.findById(id);

  if (!plan) {
    notFound();
  }

  return (
    <PlanForm
      mode="edit"
      planId={plan.id}
      planName={plan.name}
      defaultValues={{
        name: plan.name,
        description: plan.description ?? "",
        monthlyPrice: plan.monthlyPrice ?? "",
        annualPrice: plan.annualPrice ?? "",
        currency: plan.currency,
        highlights: plan.features.highlights.join("\n"),
        accentColor: plan.features.accentColor ?? "#e2e8f0",
        isActive: plan.isActive,
      }}
    />
  );
}
