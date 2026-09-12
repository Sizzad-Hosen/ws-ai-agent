"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveStoreSettingsAction } from "@/features/tenant-settings/actions/save-store-settings-action";
import {
  SETTING_GROUPS,
  settingsInGroup,
  STORE_SETTINGS,
  type SettingDefinition,
} from "@/features/tenant-settings/definitions";
import type { SettingValues } from "@/features/tenant-settings/parse-settings";

interface StoreSettingsFormProps {
  readonly slug: string;
  readonly values: SettingValues;
}

export function StoreSettingsForm({ slug, values }: StoreSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Readonly<Record<string, string>>
  >({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setMessage(null);
    setFieldErrors({});

    // Built key by key from the definitions rather than from the FormData, so
    // an unchecked switch — which submits nothing — is sent as false instead of
    // being missing and read as "leave it alone".
    const submitted: Record<string, unknown> = {};

    for (const setting of STORE_SETTINGS) {
      submitted[setting.key] =
        setting.kind === "switch"
          ? form.get(setting.key) !== null
          : String(form.get(setting.key) ?? "");
    }

    startTransition(async () => {
      const result = await saveStoreSettingsAction(slug, submitted);

      setMessage(result.message);
      setFailed(!result.success);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {SETTING_GROUPS.map((group) => (
        <fieldset key={group} className="space-y-4">
          <legend className="text-foreground text-sm font-semibold">
            {group}
          </legend>

          {settingsInGroup(group).map((setting) => (
            <SettingInput
              key={setting.key}
              setting={setting}
              value={values[setting.key]}
              error={fieldErrors[setting.key]}
            />
          ))}
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isPending ? "Saving…" : "Save settings"}
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

function SettingInput({
  setting,
  value,
  error,
}: {
  readonly setting: SettingDefinition;
  readonly value: string | boolean | undefined;
  readonly error: string | undefined;
}) {
  if (setting.kind === "switch") {
    return (
      <div className="space-y-1">
        <Switch
          name={setting.key}
          label={setting.label}
          defaultChecked={value === true}
        />
        {setting.help ? (
          <p className="text-muted-foreground text-xs">{setting.help}</p>
        ) : null}
      </div>
    );
  }

  return (
    <FormField htmlFor={setting.key} label={setting.label} error={error}>
      {setting.kind === "select" ? (
        <Select
          id={setting.key}
          name={setting.key}
          defaultValue={typeof value === "string" ? value : setting.fallback}
          options={setting.options}
        />
      ) : (
        <Input
          id={setting.key}
          name={setting.key}
          defaultValue={typeof value === "string" ? value : ""}
          maxLength={setting.maxLength}
        />
      )}
      {setting.help ? (
        <p className="text-muted-foreground text-xs">{setting.help}</p>
      ) : null}
    </FormField>
  );
}
