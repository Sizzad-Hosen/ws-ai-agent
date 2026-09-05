"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, LoaderCircle, Megaphone, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveSiteSettingsAction } from "@/features/system/actions/save-site-settings-action";
import {
  siteSettingsFormSchema,
  type SiteSettings,
} from "@/features/system/site-settings";

interface SiteSettingsFormProps {
  readonly defaultValues: SiteSettings;
  readonly canManage: boolean;
}

export function SiteSettingsForm({
  defaultValues,
  canManage,
}: SiteSettingsFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SiteSettings>({
    resolver: zodResolver(siteSettingsFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  // Held locally rather than via `watch()`, which the React Compiler cannot
  // memoize safely; `setValue` keeps the form state in step.
  const [announcing, setAnnouncing] = useState(
    defaultValues.announcement.enabled,
  );

  function toggleAnnouncement(next: boolean): void {
    setAnnouncing(next);
    setValue("announcement.enabled", next);
  }

  async function onSubmit(values: SiteSettings): Promise<void> {
    setFormError(null);
    setSaved(null);

    const result = await saveSiteSettingsAction(values);

    if (!result.success) {
      setFormError(result.message);
      return;
    }

    setSaved(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Card>
        <CardHeader
          title="Public site branding"
          icon={<Globe className="size-4" aria-hidden="true" />}
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField
            htmlFor="brandName"
            label="Platform name"
            error={errors.brand?.name?.message}
          >
            <Input
              id="brandName"
              disabled={!canManage}
              {...register("brand.name")}
            />
          </FormField>

          <FormField
            htmlFor="brandPrimary"
            label="Primary colour"
            error={errors.brand?.primary?.message}
          >
            <Input
              id="brandPrimary"
              disabled={!canManage}
              placeholder="#10B981"
              {...register("brand.primary")}
            />
          </FormField>

          <FormField
            htmlFor="supportEmail"
            label="Support email"
            error={errors.contact?.supportEmail?.message}
          >
            <Input
              id="supportEmail"
              type="email"
              autoComplete="off"
              disabled={!canManage}
              {...register("contact.supportEmail")}
            />
          </FormField>

          <FormField
            htmlFor="salesEmail"
            label="Sales email"
            error={errors.contact?.salesEmail?.message}
          >
            <Input
              id="salesEmail"
              type="email"
              autoComplete="off"
              disabled={!canManage}
              {...register("contact.salesEmail")}
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Announcement banner"
          icon={<Megaphone className="size-4" aria-hidden="true" />}
        />
        <CardBody className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <span>
              <Label>Show announcement</Label>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Displays a banner across the public site
              </span>
            </span>
            <Switch
              label="Show announcement"
              defaultChecked={defaultValues.announcement.enabled}
              onCheckedChange={toggleAnnouncement}
              disabled={!canManage}
            />
          </div>

          <FormField
            htmlFor="announcementMessage"
            label="Message"
            error={errors.announcement?.message?.message}
          >
            <Textarea
              id="announcementMessage"
              rows={2}
              disabled={!canManage || !announcing}
              {...register("announcement.message")}
            />
          </FormField>
        </CardBody>
      </Card>

      {canManage ? (
        <div className="space-y-3">
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
              Save settings
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
    </form>
  );
}
