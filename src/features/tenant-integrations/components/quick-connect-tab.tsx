"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConnectButton } from "@/features/tenant-whatsapp/components/connect-button";
import { translate, type Locale } from "@/lib/i18n/translate";

/**
 * Quick connect — Meta's Embedded Signup.
 *
 * Two gates stand between the tab opening and the popup, and both exist
 * because of what goes wrong without them.
 *
 * **The portfolio question.** Embedded Signup can create a Meta Business
 * Portfolio inside the flow, and for a shop that does not already have one
 * that means days of Meta review, in a popup, with no way back. Asking first
 * costs one click and sends the wrong shop to Manual setup before they are
 * stuck rather than after.
 *
 * **The acknowledgement.** Portfolio approval is Meta's decision and we cannot
 * influence it. A tenant who has not read that will read a Meta rejection as
 * our fault, and support gets a ticket we cannot act on.
 */

type Stage = "intro" | "asking" | "declined" | "ready";

interface QuickConnectTabProps {
  readonly slug: string;
  readonly locale: Locale;
  /** False when the platform has no Meta app or Embedded Signup config. */
  readonly ready: boolean;
  readonly onUseManual: () => void;
}

const META_BUSINESS_URL = "https://business.facebook.com/";

export function QuickConnectTab({
  slug,
  locale,
  ready,
  onUseManual,
}: QuickConnectTabProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [acknowledged, setAcknowledged] = useState(false);
  const [stage, setStage] = useState<Stage>("intro");

  if (stage === "declined") {
    return (
      <div className="space-y-4">
        <p className="text-foreground text-sm">{t("connect.quick.noAnswer")}</p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onUseManual}>
            {t("connect.quick.useManual")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStage("intro")}
          >
            {t("connect.quick.back")}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("connect.quick.point3")}
        </p>

        <ConnectButton
          slug={slug}
          label={t("integrations.connectWhatsapp")}
          disabled={!ready}
          disabledReason={ready ? undefined : t("connect.comingSoonHint")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-rose-600"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-rose-900">
          {t("connect.quick.warning")}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold">
          {t("connect.quick.beforeTitle")}
        </h3>

        <ul className="space-y-2.5">
          {(
            [
              "connect.quick.point1",
              "connect.quick.point2",
              "connect.quick.point3",
            ] as const
          ).map((key) => (
            <li key={key} className="flex gap-2.5">
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <p className="text-muted-foreground text-sm">
                {key === "connect.quick.point1" ? (
                  <>
                    {t(key).replace(" Meta Business before you start.", " ")}
                    <a
                      href={META_BUSINESS_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary-deep font-medium underline underline-offset-2"
                    >
                      {t("connect.quick.metaBusiness")}
                    </a>
                    .
                  </>
                ) : (
                  t(key)
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-border border-t pt-4">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            className="mt-0.5"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.currentTarget.checked)}
          />
          <span className="text-foreground text-sm">
            {t("connect.quick.acknowledge")}
          </span>
        </label>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!acknowledged}
        onClick={() => setStage("asking")}
      >
        {t("connect.quick.continue")}
      </Button>

      {stage === "asking" ? (
        <PortfolioQuestion
          locale={locale}
          onYes={() => setStage("ready")}
          onNo={() => setStage("declined")}
          onDismiss={() => setStage("intro")}
        />
      ) : null}
    </div>
  );
}

/**
 * The one question worth asking before the popup opens.
 *
 * Rendered inline rather than as a second `<dialog>`: two modals open at once
 * is a focus-management problem the browser does not solve for you, and the
 * question only has to be answered once.
 */
function PortfolioQuestion({
  locale,
  onYes,
  onNo,
  onDismiss,
}: {
  readonly locale: Locale;
  readonly onYes: () => void;
  readonly onNo: () => void;
  readonly onDismiss: () => void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div
      role="group"
      aria-label={t("connect.quick.portfolioQuestion")}
      className="border-border bg-card space-y-4 rounded-lg border p-4 shadow-sm"
    >
      <h3 className="text-foreground text-base font-semibold">
        {t("connect.quick.portfolioQuestion")}
      </h3>

      <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-rose-600"
          aria-hidden="true"
        />
        <p className="text-sm text-rose-900">{t("connect.quick.warning")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onYes}
          className="border-border hover:border-primary hover:bg-muted/40 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="text-foreground block text-sm font-semibold">
            {t("connect.quick.yes")}
          </span>
          <span className="text-muted-foreground block text-xs">
            {t("connect.quick.yesHint")}
          </span>
        </button>

        <button
          type="button"
          onClick={onNo}
          className="border-border hover:border-primary hover:bg-muted/40 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="text-foreground block text-sm font-semibold">
            {t("connect.quick.no")}
          </span>
          <span className="text-muted-foreground block text-xs">
            {t("connect.quick.noHint")}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
      >
        {t("connect.quick.back")}
      </button>
    </div>
  );
}
