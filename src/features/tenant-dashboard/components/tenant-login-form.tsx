"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenantLoginAction } from "@/features/tenant-dashboard/actions/tenant-login-action";

interface TenantLoginFormProps {
  readonly slug: string;
}

export function TenantLoginForm({ slug }: TenantLoginFormProps) {
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
      const outcome = await tenantLoginAction(slug, {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        rememberMe: form.get("rememberMe") === "on",
      });

      // A success redirects, so reaching here at all means it failed.
      setError(outcome.message);
      setFieldErrors(outcome.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          aria-invalid={fieldErrors.email ? true : undefined}
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-destructive text-xs">
            {fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          Password <span aria-hidden="true">*</span>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          aria-invalid={fieldErrors.password ? true : undefined}
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-destructive text-xs">
            {fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        <Checkbox name="rememberMe" />
        Keep me signed in
      </label>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Sign in
      </Button>
    </form>
  );
}
