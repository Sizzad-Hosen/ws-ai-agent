import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Which screen of the connect wizard a tenant is looking at.
 *
 * Pure, and free of React and of the database, so the rules can be unit-tested
 * and so the page, the step links and the server actions all agree on what
 * "step 3" means rather than each deciding for itself.
 *
 * Two things can claim to know the step: the URL, because the tenant clicked
 * Next or pressed Back, and the `whatsapp_accounts.setup_step` column, because
 * they closed the tab three days ago. `resolveStep` decides between them, and
 * the rule it applies is the one that matters for a setup that spans days —
 * see its comment.
 */

export const WIZARD_STEPS = [1, 2, 3, 4, 5] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const FIRST_STEP: WizardStep = 1;
export const LAST_STEP: WizardStep = 5;

export interface WizardStepDefinition {
  readonly step: WizardStep;
  readonly titleKey: MessageKey;
  /** A word or two for the progress bar, where the full title will not fit. */
  readonly shortKey: MessageKey;
}

/**
 * The five screens, in order.
 *
 * Titles are message keys rather than text: every string a tenant reads comes
 * from `src/lib/i18n`, so this file stays language-free.
 */
export const WIZARD_STEP_DEFINITIONS: readonly WizardStepDefinition[] = [
  { step: 1, titleKey: "wizard.step1.title", shortKey: "wizard.step1.title" },
  { step: 2, titleKey: "wizard.step2.title", shortKey: "wizard.step2.title" },
  { step: 3, titleKey: "wizard.step3.title", shortKey: "wizard.step3.title" },
  { step: 4, titleKey: "wizard.step4.title", shortKey: "wizard.step4.title" },
  { step: 5, titleKey: "wizard.step5.title", shortKey: "wizard.step5.title" },
];

export function isWizardStep(value: unknown): value is WizardStep {
  return (
    typeof value === "number" &&
    (WIZARD_STEPS as readonly number[]).includes(value)
  );
}

/**
 * Forces any number into range.
 *
 * Clamps rather than rejects. `?step=9` in the address bar is a typo or a stale
 * bookmark, and showing the last screen is a better answer than an error page
 * to somebody who is halfway through connecting a phone number.
 */
export function clampStep(raw: number): WizardStep {
  if (!Number.isFinite(raw)) return FIRST_STEP;

  const rounded = Math.trunc(raw);

  if (rounded <= FIRST_STEP) return FIRST_STEP;
  if (rounded >= LAST_STEP) return LAST_STEP;

  return rounded as WizardStep;
}

/**
 * Reads a step out of a query string.
 *
 * Anything unreadable falls back to the saved step, which is what a tenant
 * returning to a bare `/connect` should see.
 */
export function parseStep(
  raw: string | string[] | undefined,
  saved: number,
): WizardStep {
  const first = Array.isArray(raw) ? raw[0] : raw;

  if (first === undefined || first.trim() === "") return clampStep(saved);

  const parsed = Number.parseInt(first, 10);

  return Number.isNaN(parsed) ? clampStep(saved) : clampStep(parsed);
}

/**
 * The step to render, given the URL and the row.
 *
 * The URL wins whenever it names a step at or before the saved one. That is
 * what makes Back work, and what lets a tenant re-read the instructions on
 * step 2 after they have already pasted their token.
 *
 * It does not win when it jumps ahead. Somebody who saved credentials and got
 * to step 4 can return to 4; somebody who has saved nothing cannot reach 4 by
 * editing the address bar and land on a screen whose verify token does not
 * exist yet. The saved step is the ceiling, and it only ever moves forward as
 * real work completes.
 */
export function resolveStep(
  requested: string | string[] | undefined,
  saved: number,
): WizardStep {
  const ceiling = clampStep(saved);
  const wanted = parseStep(requested, saved);

  return wanted <= ceiling ? wanted : ceiling;
}

/** How full the progress bar is, as a percentage. Step 1 is not zero. */
export function progressPercent(step: WizardStep): number {
  return Math.round((step / LAST_STEP) * 100);
}

export function nextStep(step: WizardStep): WizardStep {
  return clampStep(step + 1);
}

export function previousStep(step: WizardStep): WizardStep {
  return clampStep(step - 1);
}

/**
 * The saved step after finishing `step`.
 *
 * Never goes backwards: a tenant who returns to step 2 to re-read something
 * and clicks Next must not lose the credentials they already saved.
 */
export function advanceSavedStep(saved: number, finished: WizardStep): number {
  return Math.max(clampStep(saved), nextStep(finished));
}
