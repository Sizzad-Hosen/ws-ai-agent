"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyField } from "@/features/tenant-whatsapp/components/wizard/copy-field";
import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import { translate, type Locale } from "@/lib/i18n/translate";

/**
 * Manual setup — partner access.
 *
 * The tenant grants us partial access to their own WhatsApp Business Account
 * from Meta Business Settings. They never open a developer console, never
 * create an app, and never paste a token.
 *
 * The reassurance box at the top is not decoration. A shop owner reading
 * "Assign Partners" reasonably fears they are handing over their WhatsApp, and
 * a flow that does not say otherwise in plain words is abandoned at step 3.
 * That sentence is the most load-bearing copy on this screen.
 */

interface ManualSetupTabProps {
  readonly slug: string;
  readonly locale: Locale;
  readonly productName: string;
  /** Empty when this deployment is not an approved Meta partner yet. */
  readonly partnerBusinessId: string;
}

interface PhoneNumberOption {
  readonly id: string;
  readonly displayPhoneNumber: string;
  readonly verifiedName: string;
}

const META_BUSINESS_SETTINGS_URL = "https://business.facebook.com/settings/";

export function ManualSetupTab({
  slug,
  locale,
  productName,
  partnerBusinessId,
}: ManualSetupTabProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const configured = partnerBusinessId !== "";

  const [wabaId, setWabaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<readonly PhoneNumberOption[] | null>(
    null,
  );

  async function onFind(): Promise<void> {
    setBusy(true);
    setError(null);
    setNumbers(null);

    try {
      const response = await fetch(
        `${tenantBasePath(slug)}/api/whatsapp/partner/phone-numbers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ wabaId: wabaId.trim() }),
        },
      );

      const body: unknown = await response.json().catch(() => null);

      const data =
        body && typeof body === "object" && "data" in body
          ? (body as { data: { numbers?: readonly PhoneNumberOption[] } }).data
          : null;

      // Anything other than a list of numbers is the same sentence to a shop
      // owner: we cannot see your account yet. Meta's own wording names
      // scopes and permissions, which is no help to somebody on step 4.
      if (!response.ok || !data?.numbers || data.numbers.length === 0) {
        setError(t("connect.manual.notVisible"));
        return;
      }

      setNumbers(data.numbers);
    } catch {
      setError(t("connect.manual.notVisible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3.5">
        <p className="text-sm text-emerald-950">
          {translate(locale, "connect.manual.intro", { product: productName })}
        </p>

        <div className="flex gap-2.5 rounded-md border border-emerald-200 bg-white/70 px-3 py-2.5">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <p className="text-xs text-emerald-900">
            {t("connect.manual.reassure")}
          </p>
        </div>
      </div>

      {!configured ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <strong className="font-semibold">{t("connect.comingSoon")}</strong>{" "}
          {t("connect.comingSoonHint")}
        </p>
      ) : null}

      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">
          {t("connect.manual.howTo")}
        </h3>

        <ol className="divide-border divide-y">
          <Step number={1} title={t("connect.manual.step1")}>
            <p className="text-muted-foreground text-xs">
              {t("connect.manual.step1Hint")}
            </p>
            <a
              href={META_BUSINESS_SETTINGS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-deep mt-1 inline-block text-xs font-medium underline underline-offset-2"
            >
              {t("connect.manual.step1")}
            </a>
          </Step>

          <Step number={2} title={t("connect.manual.step2")}>
            <p className="text-muted-foreground text-xs">
              {t("connect.manual.step2Hint")}
            </p>
          </Step>

          <Step number={3} title={t("connect.manual.step3")}>
            <p className="text-muted-foreground mb-2 text-xs">
              {t("connect.manual.step3Hint")}
            </p>
            {configured ? (
              <CopyField
                id="partner-business-id"
                label={t("connect.manual.businessIdLabel")}
                value={partnerBusinessId}
                copyLabel={t("common.copy")}
                copiedLabel={t("common.copied")}
              />
            ) : (
              <p className="text-muted-foreground text-xs italic">
                {t("connect.manual.unconfigured")}
              </p>
            )}
          </Step>

          <Step number={4} title={t("connect.manual.step4")}>
            <p className="text-muted-foreground text-xs">
              {t("connect.manual.step4Hint")}
            </p>
          </Step>

          <Step number={5} title={t("connect.manual.step5")}>
            <p className="text-muted-foreground mb-2 text-xs">
              {t("connect.manual.step5Hint")}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="waba-id">{t("connect.manual.wabaLabel")}</Label>
              <Input
                id="waba-id"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 1375151311080458"
                value={wabaId}
                disabled={!configured}
                onChange={(event) => setWabaId(event.currentTarget.value)}
                className="font-mono"
              />
            </div>
          </Step>
        </ol>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {numbers ? (
        <fieldset className="space-y-2">
          <legend className="text-foreground mb-2 text-sm font-semibold">
            {t("connect.manual.chooseNumber")}
          </legend>

          {numbers.map((number) => (
            <label
              key={number.id}
              className="border-border hover:border-primary flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
            >
              <input
                type="radio"
                name="phone-number"
                value={number.id}
                className="accent-primary size-4"
              />
              <span className="min-w-0">
                <span className="text-foreground block truncate font-mono text-sm">
                  {number.displayPhoneNumber}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {number.verifiedName}
                </span>
              </span>
            </label>
          ))}

          <Button type="button" className="mt-2 w-full">
            {t("connect.manual.connectNumber")}
          </Button>
        </fieldset>
      ) : (
        <Button
          type="button"
          className="w-full"
          disabled={!configured || busy || wabaId.trim() === ""}
          onClick={() => void onFind()}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {busy ? t("connect.manual.finding") : t("connect.manual.find")}
        </Button>
      )}
    </div>
  );
}

/** One numbered step, with the green circle from the reference design. */
function Step({
  number,
  title,
  children,
}: {
  readonly number: number;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <li className="flex gap-3 py-3.5">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white"
        aria-hidden="true"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
