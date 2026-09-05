"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveAiConfigurationAction } from "@/features/ai-settings/actions/save-ai-configuration-action";
import {
  aiConfigurationFormSchema,
  type AiConfigurationFormValues,
} from "@/features/ai-settings/schemas";
import type { AiConfigurationView } from "@/features/ai-settings/types";
import { formatNumber, formatRelativeTime } from "@/utils/format";

interface AiConfigurationFormProps {
  readonly view: AiConfigurationView;
  readonly canManage: boolean;
  readonly defaultValues: AiConfigurationFormValues;
}

export function AiConfigurationForm({
  view,
  canManage,
  defaultValues,
}: AiConfigurationFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AiConfigurationFormValues>({
    resolver: zodResolver(aiConfigurationFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  // Held locally rather than via `watch()`, which the React Compiler cannot
  // memoize safely; `setValue` keeps the form state in step.
  const [providerId, setProviderId] = useState(defaultValues.providerId);
  const [allocationEnabled, setAllocationEnabled] = useState(
    defaultValues.tenantAllocationEnabled,
  );
  const [isActive, setIsActive] = useState(defaultValues.isActive);

  const { configuration, providers, models } = view;
  const providerModels = models.filter(
    (model) => model.providerId === providerId,
  );
  const now = new Date();
  const usage = view.currentTokenUsage;
  const limit = configuration.globalTokenLimit ?? 0;

  function selectProvider(next: string): void {
    setProviderId(next);
    setValue("providerId", next);

    // The model list is provider-scoped, so a stale selection would submit a
    // pair that cannot serve traffic.
    const first = models.find((model) => model.providerId === next);
    setValue("modelId", first?.id ?? "");
  }

  function toggleAllocation(next: boolean): void {
    setAllocationEnabled(next);
    setValue("tenantAllocationEnabled", next);
  }

  function toggleActive(next: boolean): void {
    setIsActive(next);
    setValue("isActive", next);
  }

  async function onSubmit(values: AiConfigurationFormValues): Promise<void> {
    setFormError(null);
    setSaved(null);

    const result = await saveAiConfigurationAction(values);

    if (!result.success) {
      for (const [field, messages] of Object.entries(
        result.fieldErrors ?? {},
      )) {
        const message = messages?.[0];
        if (message) {
          setError(field as keyof AiConfigurationFormValues, {
            type: "server",
            message,
          });
        }
      }
      setFormError(result.message);
      return;
    }

    setSaved(result.message);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-4 lg:grid-cols-3"
    >
      <Card className="lg:col-span-2">
        <CardHeader
          title="Provider Settings"
          actions={
            <Badge tone={isActive ? "success" : "neutral"} dot>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          }
        />
        <CardBody className="space-y-5">
          <FormField
            htmlFor="provider"
            label="AI Provider"
            error={errors.providerId?.message}
          >
            <Select
              id="provider"
              value={providerId}
              onChange={(event) => selectProvider(event.target.value)}
              disabled={!canManage}
              options={providers.map((provider) => ({
                value: provider.id,
                label:
                  provider.status === "active"
                    ? provider.name
                    : `${provider.name} (inactive)`,
              }))}
            />
          </FormField>

          <div className="space-y-2">
            <Label htmlFor="credential">Secret API Key</Label>
            <div className="relative">
              <KeyRound
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="credential"
                type="password"
                autoComplete="off"
                disabled
                placeholder="Managed outside this console"
                className="pl-10"
              />
            </div>

            {/*
              The mockup offers entry and reveal controls here. `secret_reference`
              stores a pointer into a secret manager rather than the key itself,
              and no secret manager is configured, so there is nowhere to put a
              key entered here — see S-01 / D-24.
            */}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldAlert
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                The credential column holds a secret-manager reference, not the
                key. No secret manager is configured yet, so the key cannot be
                set or rotated from here.
                {configuration.credentialRotatedAt ? (
                  <>
                    {" "}
                    Configuration last changed{" "}
                    {formatRelativeTime(configuration.credentialRotatedAt, now)}
                    .
                  </>
                ) : null}
              </span>
            </p>
          </div>

          <FormField
            htmlFor="model"
            label="Model Name"
            error={errors.modelId?.message}
          >
            <Select
              id="model"
              disabled={!canManage}
              options={providerModels.map((model) => ({
                value: model.id,
                label: model.modelName,
              }))}
              {...register("modelId")}
            />
            <p className="text-muted-foreground text-xs">
              Only models belonging to the selected provider are offered.
            </p>
          </FormField>

          <div className="flex items-start justify-between gap-4">
            <span>
              <Label>Configuration active</Label>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Inactive configurations are not used to serve traffic
              </span>
            </span>
            <Switch
              label="Configuration active"
              defaultChecked={defaultValues.isActive}
              onCheckedChange={toggleActive}
              disabled={!canManage}
            />
          </div>

          {canManage ? (
            <div className="border-border space-y-3 border-t pt-5">
              {formError ? (
                <p className="text-destructive text-sm" role="alert">
                  {formError}
                </p>
              ) : null}
              {saved ? (
                <p className="text-success text-sm" role="status">
                  {saved}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => router.refresh()}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="AI Allocation & Token Limits" />
        <CardBody className="space-y-5">
          <FormField
            htmlFor="globalLimit"
            label="Global Token Size Limit"
            error={errors.globalTokenLimit?.message}
          >
            <div className="relative">
              <Input
                id="globalLimit"
                inputMode="numeric"
                disabled={!canManage}
                className="pr-16"
                {...register("globalTokenLimit")}
              />
              <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                tokens
              </span>
            </div>
          </FormField>

          <div className="flex items-start justify-between gap-4">
            <span>
              <Label>Tenant-Level Allocation</Label>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Enable per-tenant token limits and quotas
              </span>
            </span>
            <Switch
              label="Tenant-level allocation"
              defaultChecked={defaultValues.tenantAllocationEnabled}
              onCheckedChange={toggleAllocation}
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
                Usage rollups are not available, so consumption cannot be shown.
                Zero and unknown are not the same thing.
              </p>
            ) : (
              <>
                <Progress
                  value={usage}
                  max={limit}
                  label="Global token consumption"
                  warningThreshold={configuration.warningThresholdPercent ?? 80}
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
            <FormField
              htmlFor="tenantLimit"
              label="Default Tenant Limit"
              error={errors.defaultTenantTokenLimit?.message}
            >
              <Input
                id="tenantLimit"
                inputMode="numeric"
                disabled={!canManage || !allocationEnabled}
                {...register("defaultTenantTokenLimit")}
              />
            </FormField>
            <FormField
              htmlFor="threshold"
              label="Warning Threshold (%)"
              error={errors.warningThresholdPercent?.message}
            >
              <Input
                id="threshold"
                inputMode="numeric"
                disabled={!canManage}
                {...register("warningThresholdPercent")}
              />
            </FormField>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
