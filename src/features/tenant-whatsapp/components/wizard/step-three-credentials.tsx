"use client";

import {
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validateCredentialsAction,
  type VerifiedNumber,
} from "@/features/tenant-whatsapp/actions/wizard-actions";
import type { MessageKey } from "@/lib/i18n/messages";
import { translate, type Locale } from "@/lib/i18n/translate";

/**
 * The credentials screen.
 *
 * The token and the app secret are `type="password"` with a toggle, for the
 * same reason a password field is: these get pasted in shops, in cafés, on
 * shared screens, and an access token on display is an access token spent.
 *
 * Neither value is ever put in a URL, and neither is echoed back by the
 * server. The action answers with what Meta said about the *number* — the
 * display number, the verified name, the rating — which is what proves the
 * token worked without repeating it.
 */

interface StepThreeCredentialsProps {
  readonly slug: string;
  readonly locale: Locale;
}

export function StepThreeCredentials({
  slug,
  locale,
}: StepThreeCredentialsProps) {
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerifiedNumber | null>(null);

  async function onSubmit(formData: FormData): Promise<void> {
    setBusy(true);
    setError(null);
    setVerified(null);

    const result = await validateCredentialsAction({
      slug,
      wabaId: String(formData.get("wabaId") ?? ""),
      phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
      accessToken: String(formData.get("accessToken") ?? ""),
      appSecret: String(formData.get("appSecret") ?? "") || undefined,
    });

    if (result.ok) {
      setVerified(result.data);
    } else {
      setError(t(result.messageKey, result.vars));
    }

    setBusy(false);
  }

  return (
    <form action={(formData) => void onSubmit(formData)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phoneNumberId">
            {t("wizard.step3.phoneNumberId")}
          </Label>
          <Input
            id="phoneNumberId"
            name="phoneNumberId"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-[13px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wabaId">{t("wizard.step3.wabaId")}</Label>
          <Input
            id="wabaId"
            name="wabaId"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-[13px]"
          />
        </div>
      </div>

      <SecretInput
        id="accessToken"
        label={t("wizard.step3.accessToken")}
        required
        visible={showToken}
        onToggle={() => setShowToken((value) => !value)}
        showLabel={t("common.show")}
        hideLabel={t("common.hide")}
      />

      <SecretInput
        id="appSecret"
        label={t("wizard.step3.appSecret")}
        help={t("wizard.step3.appSecretHelp")}
        required={false}
        visible={showSecret}
        onToggle={() => setShowSecret((value) => !value)}
        showLabel={t("common.show")}
        hideLabel={t("common.hide")}
      />

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {t("wizard.step3.encrypted")}
      </p>

      {error ? (
        <p className="text-destructive max-w-prose text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {verified ? (
        <div className="border-success/40 bg-success-container/40 flex items-start gap-3 rounded-lg border p-4">
          <CircleCheck
            className="text-success mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {verified.displayPhoneNumber ?? "Your number"} —{" "}
              {verified.verifiedName ?? "no name yet"}
            </p>
            <p className="text-muted-foreground">
              Meta accepted this token. Quality{" "}
              {verified.qualityRating ?? "not rated"}, limit{" "}
              {verified.messagingLimit ?? "standard"}.
            </p>
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {busy ? t("common.saving") : t("wizard.step3.save")}
      </Button>
    </form>
  );
}

function SecretInput({
  id,
  label,
  help,
  required,
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  readonly id: string;
  readonly label: string;
  readonly help?: string;
  readonly required: boolean;
  readonly visible: boolean;
  readonly onToggle: () => void;
  readonly showLabel: string;
  readonly hideLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[13px]"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onToggle}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          {visible ? hideLabel : showLabel}
        </Button>
      </div>
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
    </div>
  );
}
