import Link from "next/link";
import { Check, LifeBuoy } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardBody } from "@/components/ui/card";
import {
  LAST_STEP,
  WIZARD_STEP_DEFINITIONS,
  progressPercent,
  type WizardStep,
} from "@/features/tenant-whatsapp/wizard";
import type { Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/**
 * The frame every wizard screen renders inside.
 *
 * It owns the two things that must not differ between screens: where the
 * tenant is, and how to get help. A progress bar copied into five files is how
 * one screen quietly ends up claiming step 3 of 4.
 *
 * `ui.Progress` is not used here. It turns the bar amber and then red as it
 * fills, which is right for a usage meter and exactly wrong for progress
 * through a setup — nobody should see "nearly finished" rendered as danger.
 */

interface WizardShellProps {
  readonly t: Translator;
  readonly step: WizardStep;
  /** How far the tenant has actually got. Later steps are not linkable. */
  readonly reached: WizardStep;
  readonly basePath: string;
  /** Where "I am stuck" goes. A wa.me link, or null to hide it. */
  readonly supportHref: string | null;
  readonly children: ReactNode;
}

export function WizardShell({
  t,
  step,
  reached,
  basePath,
  supportHref,
  children,
}: WizardShellProps) {
  const percent = progressPercent(step);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("wizard.title")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("wizard.progress", { current: step, total: LAST_STEP })}
          </p>
        </div>

        <div
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={LAST_STEP}
          aria-label={t("wizard.progress", { current: step, total: LAST_STEP })}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="flex flex-wrap gap-x-2 gap-y-1">
          {WIZARD_STEP_DEFINITIONS.map((definition) => {
            const done = definition.step < reached;
            const current = definition.step === step;
            // A step beyond what they have reached is not a link: its screen
            // would need a verify token that does not exist yet.
            const reachable = definition.step <= reached;

            const label = (
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                  current
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground",
                  reachable && !current && "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full text-[10px]",
                    done
                      ? "bg-success-container text-success"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-2.5" /> : definition.step}
                </span>
                {t(definition.shortKey)}
              </span>
            );

            return (
              <li key={definition.step}>
                {reachable && !current ? (
                  <Link
                    href={`${basePath}?step=${definition.step}`}
                    aria-current={undefined}
                  >
                    {label}
                  </Link>
                ) : (
                  <span aria-current={current ? "step" : undefined}>
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <Card>
        <CardBody className="space-y-6">{children}</CardBody>
      </Card>

      {supportHref ? (
        <p className="text-center">
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
          >
            <LifeBuoy className="size-4" aria-hidden="true" />
            {t("common.stuck")}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A numbered instruction list.
 *
 * Shared by steps 2, 3 and 4 because all three are "do this, then this" and a
 * shop owner should not have to re-learn the shape of the page each screen.
 */
export function Instructions({
  items,
}: {
  readonly items: readonly ReactNode[];
}) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <span
            className="bg-muted text-muted-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium"
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="text-sm leading-6">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A coloured note beside an instruction.
 *
 * `tone="danger"` is for the one thing on the whole wizard that silently
 * breaks everything if skipped: subscribing to the `messages` field.
 */
export function Callout({
  tone,
  icon,
  children,
}: {
  readonly tone: "warning" | "danger" | "info";
  readonly icon: ReactNode;
  readonly children: ReactNode;
}) {
  const tones = {
    warning: "border-warning/40 bg-warning-container/40 text-warning",
    danger: "border-destructive/40 bg-destructive/5 text-destructive",
    info: "border-info/40 bg-info-container/40 text-info",
  } as const;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        tones[tone],
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <p className="text-foreground max-w-prose text-sm leading-6">
        {children}
      </p>
    </div>
  );
}

/**
 * Where a screenshot will go.
 *
 * Rendered as a labelled box rather than omitted, so the page is laid out for
 * the real images from the first commit and nothing shifts when they land.
 */
export function ScreenshotSlot({
  name,
  caption,
}: {
  readonly name: string;
  readonly caption: string;
}) {
  return (
    <figure className="border-border bg-muted/40 rounded-lg border border-dashed p-4">
      <div className="text-muted-foreground grid h-40 place-items-center text-xs">
        <span className="font-mono">public/onboarding/{name}</span>
      </div>
      <figcaption className="text-muted-foreground mt-2 text-xs">
        {caption}
      </figcaption>
    </figure>
  );
}
