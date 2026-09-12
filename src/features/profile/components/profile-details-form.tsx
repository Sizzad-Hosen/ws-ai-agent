"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProfileAction } from "@/features/profile/actions/save-profile-action";
import {
  profileDetailsSchema,
  type ProfileDetails,
} from "@/features/profile/schemas";

interface ProfileDetailsFormProps {
  readonly defaultValues: ProfileDetails;
}

export function ProfileDetailsForm({ defaultValues }: ProfileDetailsFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileDetails>({
    resolver: zodResolver(profileDetailsSchema),
    defaultValues,
    mode: "onBlur",
  });

  async function onSubmit(values: ProfileDetails): Promise<void> {
    setFormError(null);
    setSaved(null);

    const result = await saveProfileAction(values);

    if (result.success) {
      setSaved(result.message);
      // The header shows the name, so the whole shell has to re-read it.
      router.refresh();
      return;
    }

    // Server-side findings the client schema cannot know, such as an address
    // another administrator already uses.
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      if (messages?.[0] && (field === "name" || field === "email")) {
        setError(field, { message: messages[0] });
      }
    }

    setFormError(result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormField htmlFor="name" label="Name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </FormField>

      <FormField
        htmlFor="email"
        label="Email address"
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </FormField>

      <p className="text-muted-foreground text-xs">
        This address is also your sign-in name.
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
          <Save className="size-4" aria-hidden="true" />
        )}
        Save changes
      </Button>
    </form>
  );
}
