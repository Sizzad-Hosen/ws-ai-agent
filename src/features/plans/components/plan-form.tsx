"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { savePlanAction } from "@/features/plans/actions/save-plan-action";
import { planFormSchema, type PlanFormValues } from "@/features/plans/schemas";
import { cn } from "@/lib/utils";

const ACCENT_SWATCHES = [
  "#e2e8f0",
  "#dbeafe",
  "#d1fae5",
  "#f3e8ff",
  "#fef3c7",
] as const;

interface PlanFormProps {
  readonly mode: "create" | "edit";
  readonly planId: string | null;
  readonly planName?: string;
  readonly defaultValues: PlanFormValues;
}

export function PlanForm({
  mode,
  planId,
  planName,
  defaultValues,
}: PlanFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [accent, setAccent] = useState(
    defaultValues.accentColor ?? ACCENT_SWATCHES[0],
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  // Held locally rather than via `watch()`, which the React Compiler cannot
  // memoize safely; `setValue` keeps the form state in step.
  const [isActive, setIsActive] = useState(defaultValues.isActive);

  function selectVisibility(next: boolean): void {
    setIsActive(next);
    setValue("isActive", next);
  }

  async function onSubmit(values: PlanFormValues): Promise<void> {
    setFormError(null);
    const result = await savePlanAction(planId, values);

    if (!result.success) {
      for (const [field, messages] of Object.entries(
        result.fieldErrors ?? {},
      )) {
        const message = messages?.[0];
        if (message) {
          setError(field as keyof PlanFormValues, {
            type: "server",
            message,
          });
        }
      }
      setFormError(result.message);
      return;
    }

    router.push(ROUTES.bo.plans);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Plan Management", href: ROUTES.bo.plans },
          { label: mode === "create" ? "Create New Plan" : "Edit Plan" },
        ]}
        title={
          mode === "create" ? "Create New Plan" : `Edit Plan: ${planName ?? ""}`
        }
        description="Configure plan details, pricing, and availability."
        actions={
          <>
            {/* Active / Draft toggle, mirroring the segmented control on screen 06. */}
            <div
              className="bg-muted inline-flex rounded-md p-0.5"
              role="group"
              aria-label="Plan visibility"
            >
              <button
                type="button"
                onClick={() => selectVisibility(true)}
                aria-pressed={isActive}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => selectVisibility(false)}
                aria-pressed={!isActive}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  !isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Draft
              </button>
            </div>

            <Button asChild variant="secondary">
              <Link href={ROUTES.bo.plans}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {mode === "create" ? "Save Plan" : "Save Changes"}
            </Button>
          </>
        }
      />

      {formError ? (
        <div
          className="border-warning/40 bg-warning-container/50 text-warning-container-foreground rounded-md border px-4 py-3 text-sm"
          role="alert"
          aria-live="polite"
        >
          {formError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Basic Information" />
            <CardBody className="space-y-5">
              <FormField
                htmlFor="name"
                label="Plan Name"
                error={errors.name?.message}
              >
                <Input
                  id="name"
                  placeholder="e.g., Enterprise Pro"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
              </FormField>

              <FormField
                htmlFor="description"
                label="Description"
                error={errors.description?.message}
              >
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Briefly describe the target audience and value proposition…"
                  aria-invalid={Boolean(errors.description)}
                  {...register("description")}
                />
              </FormField>

              <FormField
                htmlFor="highlights"
                label="Features Included (one per line)"
                error={errors.highlights?.message}
              >
                <Textarea
                  id="highlights"
                  rows={5}
                  placeholder={"Priority Support\nCustom Reports"}
                  {...register("highlights")}
                />
              </FormField>

              <fieldset>
                <legend className="text-sm leading-none font-medium">
                  Accent colour
                </legend>
                <div className="mt-2 flex gap-2">
                  {ACCENT_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => {
                        setAccent(swatch);
                        setValue("accentColor", swatch);
                      }}
                      aria-label={`Accent ${swatch}`}
                      aria-pressed={accent === swatch}
                      className={cn(
                        "size-8 rounded-md border transition-all focus-visible:outline-2 focus-visible:outline-offset-2",
                        accent === swatch
                          ? "ring-primary-deep border-transparent ring-2 ring-offset-2"
                          : "border-border",
                      )}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
                <input type="hidden" {...register("accentColor")} />
              </fieldset>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pricing" />
            <CardBody className="space-y-5">
              <FormField
                htmlFor="monthlyPrice"
                label="Monthly Price"
                error={errors.monthlyPrice?.message}
              >
                <Input
                  id="monthlyPrice"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register("monthlyPrice")}
                />
              </FormField>

              <FormField
                htmlFor="annualPrice"
                label="Annual Price"
                error={errors.annualPrice?.message}
              >
                <Input
                  id="annualPrice"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register("annualPrice")}
                />
              </FormField>

              <FormField
                htmlFor="currency"
                label="Currency"
                error={errors.currency?.message}
              >
                <Input
                  id="currency"
                  maxLength={3}
                  className="uppercase"
                  {...register("currency")}
                />
              </FormField>

              <p className="text-muted-foreground text-xs">
                Leave both prices blank for a negotiated “Custom” tier.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Status & Visibility" />
            <CardBody className="space-y-3">
              <VisibilityOption
                selected={isActive}
                title="Active"
                description="Visible to new tenants"
                onSelect={() => selectVisibility(true)}
              />
              <VisibilityOption
                selected={!isActive}
                title="Draft / Hidden"
                description="Only visible to admins"
                onSelect={() => selectVisibility(false)}
              />
              <input type="hidden" {...register("isActive")} />
            </CardBody>
          </Card>

          <Button asChild variant="ghost" className="w-full">
            <Link href={ROUTES.bo.plans}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Plan Management
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function VisibilityOption({
  selected,
  title,
  description,
  onSelect,
}: {
  readonly selected: boolean;
  readonly title: string;
  readonly description: string;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        selected ? "border-primary-deep bg-accent" : "border-border bg-card",
      )}
    >
      <span>
        <Label className="cursor-pointer">{title}</Label>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-primary-deep" : "border-border-strong",
        )}
        aria-hidden="true"
      >
        {selected ? (
          <span className="bg-primary-deep size-2 rounded-full" />
        ) : null}
      </span>
    </button>
  );
}
