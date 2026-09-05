"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { registerAction } from "@/features/public-site/actions/register-action";
import {
  REGISTRATION_INDUSTRIES,
  REGISTRATION_REGIONS,
  registrationFormSchema,
  type RegistrationFormValues,
} from "@/features/public-site/registration-schema";
import { cn } from "@/lib/utils";

import { PsButton, PsCard } from "./ui";

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      industry: REGISTRATION_INDUSTRIES[0],
      region: REGISTRATION_REGIONS[0],
    },
    mode: "onBlur",
  });

  async function onSubmit(values: RegistrationFormValues): Promise<void> {
    setFormError(null);
    const result = await registerAction(values);

    if (!result.success) {
      for (const [field, messages] of Object.entries(
        result.fieldErrors ?? {},
      )) {
        const message = messages?.[0];
        if (message) {
          setError(field as keyof RegistrationFormValues, {
            type: "server",
            message,
          });
        }
      }
      setFormError(result.message);
      return;
    }

    setCode(result.registrationCode ?? null);
  }

  if (code !== null) {
    return (
      <PsCard className="text-center">
        <CircleCheck
          className="text-ps-brand mx-auto size-10"
          aria-hidden="true"
        />
        <h2 className="text-ps-ink font-display mt-4 text-2xl font-semibold">
          Application received
        </h2>
        <p className="text-ps-ink-muted mx-auto mt-3 max-w-md text-pretty">
          Our team reviews new workspaces before provisioning. We will email you
          once the business, payment and WhatsApp checks are complete.
        </p>
        <p className="text-ps-ink-muted mt-6 text-sm">
          Your reference
          <span className="text-ps-ink tabular ml-2 font-semibold">{code}</span>
        </p>
      </PsCard>
    );
  }

  return (
    <PsCard>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field
          id="businessName"
          label="Business name"
          error={errors.businessName?.message}
        >
          <input
            id="businessName"
            autoComplete="organization"
            className={inputClass(Boolean(errors.businessName))}
            {...register("businessName")}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="ownerName"
            label="Your name"
            error={errors.ownerName?.message}
          >
            <input
              id="ownerName"
              autoComplete="name"
              className={inputClass(Boolean(errors.ownerName))}
              {...register("ownerName")}
            />
          </Field>

          <Field
            id="ownerEmail"
            label="Work email"
            error={errors.ownerEmail?.message}
          >
            <input
              id="ownerEmail"
              type="email"
              autoComplete="email"
              className={inputClass(Boolean(errors.ownerEmail))}
              {...register("ownerEmail")}
            />
          </Field>
        </div>

        <Field
          id="ownerPhone"
          label="WhatsApp number"
          hint="The number your customers already message."
          error={errors.ownerPhone?.message}
        >
          <input
            id="ownerPhone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 000 1234"
            className={inputClass(Boolean(errors.ownerPhone))}
            {...register("ownerPhone")}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="industry"
            label="Industry"
            error={errors.industry?.message}
          >
            <select
              id="industry"
              className={inputClass(Boolean(errors.industry))}
              {...register("industry")}
            >
              {REGISTRATION_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="region"
            label="Primary region"
            error={errors.region?.message}
          >
            <select
              id="region"
              className={inputClass(Boolean(errors.region))}
              {...register("region")}
            >
              {REGISTRATION_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {formError ? (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        ) : null}

        <PsButton
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Create my workspace
        </PsButton>

        <p className="text-ps-ink-subtle text-center text-xs">
          Applications are reviewed before provisioning. No card required.
        </p>
      </form>
    </PsCard>
  );
}

function inputClass(invalid: boolean): string {
  return cn(
    "bg-ps-panel text-ps-ink rounded-field w-full border px-3.5 py-2.5 text-[15px] transition-[border-color,box-shadow] outline-none",
    // Focus ring per DESIGN.md → Input Fields: emerald border, soft outer glow.
    invalid
      ? "border-destructive focus:border-destructive focus:ring-4 focus:ring-destructive/20"
      : "border-ps-edge focus:border-ps-brand focus:ring-ps-brand/20 focus:ring-4",
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ps-ink block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-ps-ink-subtle text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
