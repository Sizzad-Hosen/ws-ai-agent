import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { AiConfigurationForm } from "@/features/ai-settings/components/ai-configuration-form";
import type { AiConfigurationFormValues } from "@/features/ai-settings/schemas";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "AI Configuration",
};

function toFormString(value: number | null): string {
  return value === null ? "" : String(value);
}

export default async function AiSettingsPage() {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.AI_SETTINGS_READ);
  const view = await repositories.aiConfiguration.findActive();
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.AI_SETTINGS_MANAGE,
  );

  const { configuration } = view;

  const defaultValues: AiConfigurationFormValues = {
    providerId: configuration.providerId,
    modelId: configuration.modelId,
    isActive: configuration.isActive,
    globalTokenLimit: toFormString(configuration.globalTokenLimit),
    tenantAllocationEnabled: view.tenantAllocationEnabled,
    defaultTenantTokenLimit: toFormString(
      configuration.defaultTenantTokenLimit,
    ),
    warningThresholdPercent: toFormString(
      configuration.warningThresholdPercent,
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Configuration"
        description="Manage global AI provider settings and credentials."
      />

      <AiConfigurationForm
        view={view}
        canManage={canManage}
        defaultValues={defaultValues}
      />
    </div>
  );
}
