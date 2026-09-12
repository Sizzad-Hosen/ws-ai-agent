import {
  coerceSettingValue,
  STORE_SETTINGS,
  type SettingDefinition,
} from "./definitions";

/**
 * Turning submitted form values into values worth writing.
 *
 * Pure, so the rules are testable without a database or a request. The action
 * does the guarding and the writing; this decides what is valid.
 */

export type SettingValues = Readonly<Record<string, string | boolean>>;

export interface SettingsParseResult {
  readonly ok: boolean;
  readonly values: SettingValues;
  readonly errors: Readonly<Record<string, string>>;
}

function validate(
  definition: SettingDefinition,
  raw: unknown,
): { value: string | boolean; error?: string } {
  if (definition.kind === "switch") {
    // An unchecked checkbox submits nothing at all, which is how a switch
    // reports "off". Absent therefore means false, not "use the default".
    return { value: raw === true || raw === "on" || raw === "true" };
  }

  const text = typeof raw === "string" ? raw.trim() : "";

  if (definition.kind === "select") {
    const allowed = definition.options.some((option) => option.value === text);
    return allowed
      ? { value: text }
      : { value: definition.fallback, error: "Choose one of the options." };
  }

  if (text.length > definition.maxLength) {
    return {
      value: text.slice(0, definition.maxLength),
      error: `Use ${definition.maxLength} characters or fewer.`,
    };
  }

  if (definition.required === true && text === "") {
    return { value: text, error: "This cannot be empty." };
  }

  return { value: text };
}

/**
 * Validates every known setting against the submission.
 *
 * Only the keys in `STORE_SETTINGS` are read. A submission carrying extra keys
 * has them ignored rather than written: the form posts a fixed set of fields,
 * and anything beyond it did not come from the form.
 */
export function parseSettingsSubmission(
  submitted: Readonly<Record<string, unknown>>,
): SettingsParseResult {
  const values: Record<string, string | boolean> = {};
  const errors: Record<string, string> = {};

  for (const definition of STORE_SETTINGS) {
    const outcome = validate(definition, submitted[definition.key]);
    values[definition.key] = outcome.value;
    if (outcome.error) errors[definition.key] = outcome.error;
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/**
 * Every known setting's current value, filling in defaults for keys the
 * database has never held.
 *
 * A workspace that has never opened the Settings screen has no rows at all, and
 * the form must still render something sensible rather than blank inputs.
 */
export function currentSettingValues(
  stored: Readonly<Record<string, unknown>>,
): SettingValues {
  const values: Record<string, string | boolean> = {};

  for (const definition of STORE_SETTINGS) {
    values[definition.key] = coerceSettingValue(
      definition,
      stored[definition.key],
    );
  }

  return values;
}
