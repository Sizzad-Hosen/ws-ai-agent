"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkFirstEventAction } from "@/features/tenant-whatsapp/actions/wizard-actions";
import { CopyField } from "@/features/tenant-whatsapp/components/wizard/copy-field";
import { translate, type Locale } from "@/lib/i18n/translate";

const POLL_MS = 3000;

/**
 * The live "has Meta reached us yet" indicator.
 *
 * Subscribing to the `messages` field is the step people miss, and missing it
 * is invisible: the webhook verifies, the screen says saved, and nothing ever
 * arrives. This watches `webhook_events` and turns green on the first signed
 * delivery for the number, so the tenant finds out in three seconds rather
 * than from a customer three days later.
 *
 * Polling, not a socket. The wait is a minute at most and only while this one
 * screen is open; a websocket for that is infrastructure nobody will maintain.
 * It stops the moment an event arrives, and again when the component unmounts,
 * so a forgotten open tab is not a request every three seconds forever.
 */

interface StepFourWebhookProps {
  readonly slug: string;
  readonly locale: Locale;
  readonly callbackUrl: string;
  readonly verifyToken: string;
  /** Null until step 3 is saved; the indicator cannot poll without it. */
  readonly phoneNumberId: string | null;
}

export function StepFourWebhook({
  slug,
  locale,
  callbackUrl,
  verifyToken,
  phoneNumberId,
}: StepFourWebhookProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!phoneNumberId || arrived) return;

    let cancelled = false;

    const timer = setInterval(() => {
      void checkFirstEventAction({ slug, phoneNumberId }).then((result) => {
        if (cancelled) return;
        if (result.ok && result.data.arrived) setArrived(true);
      });
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, phoneNumberId, arrived]);

  return (
    <div className="space-y-4">
      <CopyField
        id="callback-url"
        label={t("wizard.step4.callbackUrl")}
        value={callbackUrl}
        copyLabel={t("common.copy")}
        copiedLabel={t("common.copied")}
      />

      {phoneNumberId ? (
        <CopyField
          id="verify-token"
          label={t("wizard.step4.verifyToken")}
          value={verifyToken}
          copyLabel={t("common.copy")}
          copiedLabel={t("common.copied")}
        />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="verify-token-pending">
            {t("wizard.step4.verifyToken")}
          </Label>
          <Input
            id="verify-token-pending"
            readOnly
            value=""
            placeholder="Save your credentials on step 3 first"
            className="bg-muted/50"
          />
        </div>
      )}

      <div
        className={
          arrived
            ? "border-success/40 bg-success-container/40 flex items-center gap-3 rounded-lg border p-4"
            : "border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-4"
        }
        aria-live="polite"
      >
        {arrived ? (
          <CircleCheck
            className="text-success size-5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <LoaderCircle
            className="text-muted-foreground size-5 shrink-0 animate-spin"
            aria-hidden="true"
          />
        )}
        <p className="text-sm font-medium">
          {arrived ? t("wizard.step4.arrived") : t("wizard.step4.waiting")}
        </p>
      </div>
    </div>
  );
}
