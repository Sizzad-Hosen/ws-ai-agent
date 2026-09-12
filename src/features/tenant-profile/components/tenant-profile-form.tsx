"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTenantProfileAction } from "@/features/tenant-profile/actions/save-tenant-profile-action";

interface TenantProfileFormProps {
  readonly slug: string;
  readonly name: string;
  readonly email: string;
}

export function TenantProfileForm({
  slug,
  name,
  email,
}: TenantProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await saveTenantProfileAction(slug, {
        name: String(form.get("name") ?? ""),
      });

      setMessage(result.message);
      setFailed(!result.success);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        htmlFor="name"
        label="Display name"
        error={fieldErrors.name?.[0]}
      >
        <Input
          id="name"
          name="name"
          defaultValue={name}
          maxLength={120}
          autoComplete="name"
          required
        />
      </FormField>

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" defaultValue={email} disabled readOnly />
        <p className="text-muted-foreground text-xs">
          This is how you sign in. It is also recorded on the platform side, so
          it cannot be changed from here — ask support to change it.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isPending ? "Saving…" : "Save changes"}
        </Button>

        <p aria-live="polite" className="text-xs">
          {message ? (
            <span className={failed ? "text-destructive" : "text-success"}>
              {message}
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
