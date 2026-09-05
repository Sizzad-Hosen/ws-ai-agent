import type { Metadata } from "next";
import { KeyRound, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { formatNumber, formatRelativeTime } from "@/utils/format";

export const metadata: Metadata = {
  title: "AI Configuration",
};

export default async function AiSettingsPage() {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.AI_SETTINGS_READ);
  const view = await repositories.aiConfiguration.findActive();
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.AI_SETTINGS_MANAGE,
  );

  const { configuration, providers, models } = view;
  const activeModels = models.filter(
    (model) => model.providerId === configuration.providerId,
  );
  const now = new Date();

  const usage = view.currentTokenUsage;
  const limit = configuration.globalTokenLimit ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Configuration"
        description="Manage global AI provider settings and credentials."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Provider Settings"
            actions={
              <Badge tone={configuration.isActive ? "success" : "neutral"} dot>
                {configuration.isActive ? "Active" : "Inactive"}
              </Badge>
            }
          />
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="provider">AI Provider</Label>
              <Select
                id="provider"
                defaultValue={configuration.providerId}
                disabled={!canManage}
                options={providers.map((provider) => ({
                  value: provider.id,
                  label:
                    provider.status === "active"
                      ? provider.name
                      : `${provider.name} (inactive)`,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential">Secret API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    id="credential"
                    type="password"
                    autoComplete="off"
                    disabled={!canManage}
                    placeholder={
                      configuration.credentialFingerprint
                        ? `Stored key ending ••••${configuration.credentialFingerprint}`
                        : "No key stored"
                    }
                    className="pl-10"
                  />
                </div>
                {canManage ? (
                  <Button variant="secondary">Rotate key</Button>
                ) : null}
              </div>

              {/*
                The mockup offers a reveal control here. The stored credential is
                write-only and is never returned by any read path, so only a
                last-four fingerprint is shown — see S-01 / D-24.
              */}
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <ShieldAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  The stored key is write-only and is never returned to the
                  browser. Enter a new value to replace it.
                  {configuration.credentialRotatedAt ? (
                    <>
                      {" "}
                      Last rotated{" "}
                      {formatRelativeTime(
                        configuration.credentialRotatedAt,
                        now,
                      )}
                      .
                    </>
                  ) : null}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model Name</Label>
              <Select
                id="model"
                defaultValue={configuration.modelId}
                disabled={!canManage}
                options={activeModels.map((model) => ({
                  value: model.id,
                  label: model.modelName,
                }))}
              />
              <p className="text-muted-foreground text-xs">
                Only models belonging to the selected provider are offered.
              </p>
            </div>

            {canManage ? (
              <div className="border-border flex gap-2 border-t pt-5">
                <Button>Save Changes</Button>
                <Button variant="secondary">Discard</Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="AI Allocation & Token Limits" />
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="globalLimit">Global Token Size Limit</Label>
              <div className="relative">
                <Input
                  id="globalLimit"
                  inputMode="numeric"
                  disabled={!canManage}
                  defaultValue={configuration.globalTokenLimit ?? ""}
                  className="pr-16"
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                  tokens
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span>
                <Label>Tenant-Level Allocation</Label>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Enable per-tenant token limits and quotas
                </span>
              </span>
              <Switch
                label="Tenant-level allocation"
                defaultChecked={view.tenantAllocationEnabled}
                disabled={!canManage}
              />
            </div>

            <div className="bg-subtle border-border space-y-2 rounded-md border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-foreground text-sm font-medium">
                  Current Usage Monitoring
                </span>
                <span className="text-foreground tabular text-sm font-semibold">
                  {usage === null
                    ? "Unavailable"
                    : `${formatNumber(usage)} / ${formatNumber(limit)} tokens`}
                </span>
              </div>
              {usage === null ? (
                <p className="text-muted-foreground text-xs">
                  Usage rollups are not available, so consumption cannot be
                  shown. Zero and unknown are not the same thing.
                </p>
              ) : (
                <>
                  <Progress
                    value={usage}
                    max={limit}
                    label="Global token consumption"
                    warningThreshold={
                      configuration.warningThresholdPercent ?? 80
                    }
                  />
                  {view.usageAsOf ? (
                    <p className="text-muted-foreground text-xs">
                      as of {formatRelativeTime(view.usageAsOf, now)}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenantLimit">Default Tenant Limit</Label>
                <Input
                  id="tenantLimit"
                  inputMode="numeric"
                  disabled={!canManage}
                  defaultValue={configuration.defaultTenantTokenLimit ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">Warning Threshold (%)</Label>
                <Input
                  id="threshold"
                  inputMode="numeric"
                  disabled={!canManage}
                  defaultValue={configuration.warningThresholdPercent ?? ""}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
