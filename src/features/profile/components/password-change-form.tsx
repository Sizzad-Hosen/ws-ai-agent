"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/features/profile/actions/change-password-action";
import {
  MIN_PASSWORD_LENGTH,
  passwordChangeSchema,
  type PasswordChange,
} from "@/features/profile/schemas";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

type PasswordField = (typeof FIELDS)[number];

function isPasswordField(value: string): value is PasswordField {
  return (FIELDS as readonly string[]).includes(value);
}

export function PasswordChangeForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChange>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: PasswordChange): Promise<void> {
    setFormError(null);
    setSaved(null);

    const result = await changePasswordAction(values);

    if (result.success) {
      setSaved(result.message);
      // Never leave a password sitting in a form field after it is used.
      reset();
      return;
    }

    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      if (messages?.[0] && isPasswordField(field)) {
        setError(field, { message: messages[0] });
      }
    }

    setFormError(result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormField
        htmlFor="currentPassword"
        label="Current password"
        error={errors.currentPassword?.message}
      >
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.currentPassword)}
          {...register("currentPassword")}
        />
      </FormField>

      <FormField
        htmlFor="newPassword"
        label="New password"
        error={errors.newPassword?.message}
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          {...register("newPassword")}
        />
      </FormField>

      <FormField
        htmlFor="confirmPassword"
        label="Repeat new password"
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
      </FormField>

      <p className="text-muted-foreground text-xs">
        At least {MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a
        lowercase letter and a digit. Changing it signs out your other sessions.
      </p>

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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound className="size-4" aria-hidden="true" />
        )}
        Change password
      </Button>
    </form>
  );
}
