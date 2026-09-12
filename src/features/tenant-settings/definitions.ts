/**
 * The workspace settings a tenant may change, defined once.
 *
 * `store_settings` is a key/value table with a `jsonb` value and no schema of
 * its own, which is flexible and unhelpful in equal measure: nothing says what
 * keys exist, what type each holds, or what a sensible default is. This list is
 * that missing schema.
 *
 * The form, the validation and the read path are all generated from it, so
 * adding a setting is one entry here rather than four edits that must agree.
 * A key absent from this list is still stored and still readable — the Settings
 * screen lists every row — but it is not editable through the form, because
 * nothing here knows what shape it should be.
 */

export type SettingKind = "text" | "select" | "switch";

interface BaseDefinition {
  /** The `store_settings.setting_key` value. */
  readonly key: string;
  readonly label: string;
  readonly help?: string;
  readonly group: "Store" | "AI agent";
}

export interface TextSetting extends BaseDefinition {
  readonly kind: "text";
  readonly fallback: string;
  readonly maxLength: number;
  /** Empty is allowed unless this is true. */
  readonly required?: boolean;
}

export interface SelectSetting extends BaseDefinition {
  readonly kind: "select";
  readonly fallback: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

export interface SwitchSetting extends BaseDefinition {
  readonly kind: "switch";
  readonly fallback: boolean;
}

export type SettingDefinition = TextSetting | SelectSetting | SwitchSetting;

export const STORE_SETTINGS: readonly SettingDefinition[] = [
  {
    key: "store.display_name",
    kind: "text",
    label: "Store name",
    help: "Shown to customers. Defaults to the business name on the account.",
    group: "Store",
    fallback: "",
    maxLength: 180,
  },
  {
    key: "store.support_phone",
    kind: "text",
    label: "Support phone number",
    help: "Where a customer is sent when the AI agent hands over to a person.",
    group: "Store",
    fallback: "",
    maxLength: 30,
  },
  {
    key: "store.currency",
    kind: "select",
    label: "Currency",
    help: "Used when prices are quoted in a conversation.",
    group: "Store",
    fallback: "BDT",
    options: [
      { value: "BDT", label: "BDT — Bangladeshi taka" },
      { value: "USD", label: "USD — US dollar" },
      { value: "EUR", label: "EUR — Euro" },
      { value: "GBP", label: "GBP — Pound sterling" },
    ],
  },
  {
    key: "store.delivery_fee",
    kind: "text",
    label: "Standard delivery fee",
    help: "A plain number. Leave empty if delivery is quoted per order.",
    group: "Store",
    fallback: "",
    maxLength: 12,
  },
  {
    key: "ai.auto_reply_enabled",
    kind: "switch",
    label: "Let the AI agent reply automatically",
    help: "Turn this off to keep every conversation waiting for a human.",
    group: "AI agent",
    fallback: true,
  },
  {
    key: "ai.handoff_keyword",
    kind: "text",
    label: "Hand-off keyword",
    help: "A customer typing this word is passed to a person immediately.",
    group: "AI agent",
    fallback: "agent",
    maxLength: 40,
  },
] as const;

export const SETTING_GROUPS = ["Store", "AI agent"] as const;

export function settingsInGroup(
  group: (typeof SETTING_GROUPS)[number],
): readonly SettingDefinition[] {
  return STORE_SETTINGS.filter((setting) => setting.group === group);
}

/** The keys the form owns. Anything else in the table is displayed, not edited. */
export const EDITABLE_SETTING_KEYS: ReadonlySet<string> = new Set(
  STORE_SETTINGS.map((setting) => setting.key),
);

/**
 * Reads one stored value into the type its definition promises.
 *
 * The column is `jsonb`, so anything at all may be in it — a number where a
 * string belongs, `null`, an object. A value that does not match the definition
 * falls back rather than reaching a form input as `[object Object]`.
 */
export function coerceSettingValue(
  definition: SettingDefinition,
  stored: unknown,
): string | boolean {
  if (definition.kind === "switch") {
    return typeof stored === "boolean" ? stored : definition.fallback;
  }

  if (typeof stored === "string") {
    if (definition.kind === "select") {
      const allowed = definition.options.some(
        (option) => option.value === stored,
      );
      return allowed ? stored : definition.fallback;
    }
    return stored;
  }

  // A number is close enough to a text setting to be worth keeping rather than
  // discarding — a delivery fee stored as 60 should not read as empty.
  if (typeof stored === "number" && definition.kind === "text") {
    return String(stored);
  }

  return definition.fallback;
}
