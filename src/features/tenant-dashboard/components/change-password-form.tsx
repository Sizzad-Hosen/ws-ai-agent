"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/features/tenant-dashboard/actions/change-password-action";

interface ChangePasswordFormProps {
  readonly slug: string;
  readonly minLength: number;
}

export function ChangePasswordForm({
  slug,
  minLength,
}: ChangePasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const outcome = await changePasswordAction(slug, {
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
        confirmPassword: String(form.get("confirmPassword") ?? ""),
      });

      // Success redirects to sign-in, so reaching here means it failed.
      setError(outcome.message);
      setFieldErrors(outcome.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
        errors={fieldErrors.currentPassword}
      />
      <PasswordField
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${minLength} characters.`}
        errors={fieldErrors.newPassword}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        errors={fieldErrors.confirmPassword}
      />

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Set new password
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  hint,
  errors,
}: {
  readonly id: string;
  readonly label: string;
  readonly autoComplete: string;
  readonly hint?: string;
  readonly errors?: string[];
}) {
  const describedBy =
    [errors ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        aria-describedby={describedBy}
        aria-invalid={errors ? true : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {errors ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
