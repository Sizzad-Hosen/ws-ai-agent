import { describe, expect, it } from "vitest";

import { coerceSettingValue, STORE_SETTINGS } from "./definitions";
import {
  currentSettingValues,
  parseSettingsSubmission,
} from "./parse-settings";

function definition(key: string) {
  const found = STORE_SETTINGS.find((setting) => setting.key === key);
  if (!found) throw new Error(`No setting definition for "${key}".`);
  return found;
}

describe("the setting definitions", () => {
  it("has no duplicate keys", () => {
    const keys = STORE_SETTINGS.map((setting) => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every select a fallback that is one of its own options", () => {
    for (const setting of STORE_SETTINGS) {
      if (setting.kind !== "select") continue;
      expect(setting.options.map((option) => option.value)).toContain(
        setting.fallback,
      );
    }
  });
});

describe("coerceSettingValue", () => {
  it("keeps a stored string", () => {
    expect(coerceSettingValue(definition("ai.handoff_keyword"), "human")).toBe(
      "human",
    );
  });

  it("falls back when a switch holds something that is not a boolean", () => {
    expect(coerceSettingValue(definition("ai.auto_reply_enabled"), "yes")).toBe(
      true,
    );
  });

  it("falls back when a select holds a value outside its options", () => {
    expect(coerceSettingValue(definition("store.currency"), "XYZ")).toBe("BDT");
  });

  it("reads a number stored for a text setting rather than discarding it", () => {
    expect(coerceSettingValue(definition("store.delivery_fee"), 60)).toBe("60");
  });

  it("falls back for an object, rather than rendering [object Object]", () => {
    expect(coerceSettingValue(definition("store.display_name"), { a: 1 })).toBe(
      "",
    );
  });

  it("falls back for null", () => {
    expect(coerceSettingValue(definition("store.currency"), null)).toBe("BDT");
  });
});

describe("currentSettingValues", () => {
  it("returns a value for every defined setting, even with nothing stored", () => {
    const values = currentSettingValues({});
    expect(Object.keys(values).sort()).toEqual(
      STORE_SETTINGS.map((setting) => setting.key).sort(),
    );
  });

  it("prefers a stored value over the fallback", () => {
    const values = currentSettingValues({ "store.currency": "USD" });
    expect(values["store.currency"]).toBe("USD");
  });

  it("ignores a stored key that is not defined", () => {
    const values = currentSettingValues({ "something.else": "x" });
    expect(values["something.else"]).toBeUndefined();
  });
});

describe("parseSettingsSubmission", () => {
  it("trims text values", () => {
    const result = parseSettingsSubmission({
      "store.display_name": "  Northwind  ",
    });
    expect(result.values["store.display_name"]).toBe("Northwind");
  });

  it("treats an absent switch as off, not as unchanged", () => {
    // An unchecked checkbox submits nothing. Reading that as "leave it alone"
    // would make the switch impossible to turn off.
    const result = parseSettingsSubmission({});
    expect(result.values["ai.auto_reply_enabled"]).toBe(false);
  });

  it.each(["on", "true", true])("reads %s as a switch being on", (raw) => {
    const result = parseSettingsSubmission({ "ai.auto_reply_enabled": raw });
    expect(result.values["ai.auto_reply_enabled"]).toBe(true);
  });

  it("rejects a select value outside its options", () => {
    const result = parseSettingsSubmission({ "store.currency": "XYZ" });
    expect(result.ok).toBe(false);
    expect(result.errors["store.currency"]).toBeDefined();
    expect(result.values["store.currency"]).toBe("BDT");
  });

  it("accepts a select value that is one of its options", () => {
    const result = parseSettingsSubmission({
      "store.currency": "USD",
      "ai.auto_reply_enabled": "on",
    });
    expect(result.ok).toBe(true);
    expect(result.values["store.currency"]).toBe("USD");
  });

  it("rejects text longer than the definition allows", () => {
    const result = parseSettingsSubmission({
      "ai.handoff_keyword": "x".repeat(200),
    });
    expect(result.ok).toBe(false);
    expect(result.errors["ai.handoff_keyword"]).toBeDefined();
  });

  it("ignores a submitted key that is not defined", () => {
    const result = parseSettingsSubmission({ "attacker.key": "value" });
    expect(result.values["attacker.key"]).toBeUndefined();
  });

  it("always returns every defined key, so a save writes a complete set", () => {
    const result = parseSettingsSubmission({});
    expect(Object.keys(result.values).sort()).toEqual(
      STORE_SETTINGS.map((setting) => setting.key).sort(),
    );
  });
});
