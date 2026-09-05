import type { Metadata } from "next";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { PlanForm } from "@/features/plans/components/plan-form";
import { requirePermission } from "@/server/auth/authorization";

export const metadata: Metadata = {
  title: "Create New Plan",
};

export default async function CreatePlanPage() {
  await requirePermission(PLATFORM_PERMISSIONS.PLANS_MANAGE);

  return (
    <PlanForm
      mode="create"
      planId={null}
      defaultValues={{
        name: "",
        description: "",
        monthlyPrice: "",
        annualPrice: "",
        currency: "USD",
        highlights: "",
        accentColor: "#e2e8f0",
        isActive: true,
      }}
    />
  );
}
