"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/constants/routes";
import { loginAction } from "@/features/auth/actions/login-action";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [authenticationError, setAuthenticationError] = useState<string | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
    mode: "onChange",
  });

  async function onSubmit(input: LoginInput): Promise<void> {
    setAuthenticationError(null);
    const result = await loginAction(input);

    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.[0];
          if (message) {
            setError(field as keyof LoginInput, { type: "server", message });
          }
        }
      }
      setAuthenticationError(result.message);
      return;
    }

    router.replace(ROUTES.bo.dashboard);
    router.refresh();
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {authenticationError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
          aria-live="polite"
        >
          {authenticationError}
        </div>
      ) : null}

      <FormField
        htmlFor="email"
        label="Email address"
        error={errors.email?.message}
      >
        <div className="relative">
          <Mail
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="admin@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="pl-10"
            {...register("email")}
          />
        </div>
      </FormField>

      <FormField
        htmlFor="password"
        label="Password"
        error={errors.password?.message}
      >
        <div className="relative">
          <LockKeyhole
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="px-10"
            {...register("password")}
          />
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox id="rememberMe" {...register("rememberMe")} />
        <Label
          htmlFor="rememberMe"
          className="text-muted-foreground cursor-pointer font-normal"
        >
          Keep me signed in for 30 days
        </Label>
      </div>

      <Button
        type="submit"
        className="h-11 w-full rounded-lg"
        disabled={isSubmitting || !isValid}
        aria-disabled={isSubmitting || !isValid}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
