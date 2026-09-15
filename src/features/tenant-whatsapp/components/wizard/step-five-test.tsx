"use client";

import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestMessageAction } from "@/features/tenant-whatsapp/actions/wizard-actions";
import type { MessageKey } from "@/lib/i18n/messages";
import { translate, type Locale } from "@/lib/i18n/translate";

/**
 * The last screen: prove it end to end.
 *
 * The tenant types their own number and receives one message. Everything
 * before this proves a setting was accepted; only this proves a message can
 * actually leave.
 *
 * The token is asked for again rather than read back from the row. It is
 * encrypted at rest and the screen has no business holding a copy — and on a
 * Meta test number the token is a 24-hour one, so the tenant is likely holding
 * a newer one than the row has.
 */

interface StepFiveTestProps {
  readonly slug: string;
  readonly locale: Locale;
  readonly phoneNumberId: string | null;
}

export function StepFiveTest({
  slug,
  locale,
  phoneNumberId,
}: StepFiveTestProps) {
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData): Promise<void> {
    setBusy(true);
    setError(null);
    setSent(false);

    const result = await sendTestMessageAction({
      slug,
      phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
      accessToken: String(formData.get("accessToken") ?? ""),
      // Meta rejects "+" and spaces, and a shop owner will type both.
      to: String(formData.get("to") ?? "").replace(/[^\d]/g, ""),
    });

    if (result.ok) {
      setSent(true);
    } else {
      setError(t(result.messageKey, result.vars));
    }

    setBusy(false);
  }

  return (
    <form action={(formData) => void onSubmit(formData)} className="space-y-5">
      <p className="text-muted-foreground max-w-prose text-sm leading-6">
        {t("wizard.step5.intro")}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="to">{t("wizard.step5.number")}</Label>
        <Input
          id="to"
          name="to"
          required
          inputMode="numeric"
          placeholder="8801712345678"
          className="font-mono text-[13px]"
        />
        <p className="text-muted-foreground text-xs">
          {t("wizard.step5.numberHelp")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="test-phone-number-id">
            {t("wizard.step3.phoneNumberId")}
          </Label>
          <Input
            id="test-phone-number-id"
            name="phoneNumberId"
            required
            defaultValue={phoneNumberId ?? ""}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-[13px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="test-token">{t("wizard.step3.accessToken")}</Label>
          <Input
            id="test-token"
            name="accessToken"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <p className="text-destructive max-w-prose text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {sent ? (
        <p className="text-success flex items-center gap-2 text-sm font-medium">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          {t("wizard.step5.success")}
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {t("wizard.step5.send")}
      </Button>
    </form>
  );
}
