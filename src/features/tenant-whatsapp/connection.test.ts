import { describe, expect, it } from "vitest";

import {
  CONNECTION_LABELS,
  CONNECTION_STATES,
  CONNECTION_STEPS,
  CONNECTION_TONES,
  readableError,
  stepIndexOf,
  viewFor,
  type ConnectionState,
} from "./connection";

describe("viewFor", () => {
  it("shows nothing connected when there is no account", () => {
    expect(viewFor(null)).toBe("not-connected");
  });

  it.each<[ConnectionState, string]>([
    ["PENDING", "not-connected"],
    ["DISCONNECTED", "not-connected"],
    ["CONNECTING", "connecting"],
    ["TOKEN_EXCHANGED", "connecting"],
    ["REGISTERED", "connecting"],
    ["SUBSCRIBED", "connecting"],
    ["VERIFIED", "connecting"],
    ["LIVE", "live"],
    ["FAILED", "failed"],
  ])("maps %s to %s", (state, expected) => {
    expect(viewFor(state)).toBe(expected);
  });

  it("maps every state, so a new one cannot render as blank", () => {
    for (const state of CONNECTION_STATES) {
      expect(["not-connected", "connecting", "failed", "live"]).toContain(
        viewFor(state),
      );
    }
  });

  // The rule that matters: a finished popup is not a connected tenant.
  it("does not call a subscribed-but-unverified account live", () => {
    expect(viewFor("SUBSCRIBED")).not.toBe("live");
    expect(viewFor("VERIFIED")).not.toBe("live");
  });
});

describe("the step list", () => {
  it("ends at LIVE", () => {
    expect(CONNECTION_STEPS.at(-1)?.state).toBe("LIVE");
  });

  it("has no duplicate states", () => {
    const states = CONNECTION_STEPS.map((step) => step.state);
    expect(new Set(states).size).toBe(states.length);
  });

  it("orders the states as the flow runs them", () => {
    expect(CONNECTION_STEPS.map((step) => step.state)).toEqual([
      "CONNECTING",
      "TOKEN_EXCHANGED",
      "REGISTERED",
      "SUBSCRIBED",
      "VERIFIED",
      "LIVE",
    ]);
  });

  it("advances the index as the state advances", () => {
    expect(stepIndexOf("CONNECTING")).toBe(0);
    expect(stepIndexOf("VERIFIED")).toBeGreaterThan(stepIndexOf("REGISTERED"));
    expect(stepIndexOf("LIVE")).toBe(CONNECTION_STEPS.length - 1);
  });

  it("returns -1 for a state that is not a step", () => {
    expect(stepIndexOf("FAILED")).toBe(-1);
    expect(stepIndexOf("PENDING")).toBe(-1);
  });
});

describe("labels and tones", () => {
  it("labels every state", () => {
    for (const state of CONNECTION_STATES) {
      expect(CONNECTION_LABELS[state]).toBeTruthy();
    }
  });

  it("tones every state", () => {
    for (const state of CONNECTION_STATES) {
      expect(CONNECTION_TONES[state]).toBeTruthy();
    }
  });

  it("never shows a raw enum member", () => {
    for (const state of CONNECTION_STATES) {
      expect(CONNECTION_LABELS[state]).not.toBe(state);
    }
  });
});

describe("readableError", () => {
  it("turns a known code into a sentence with an action", () => {
    const { sentence, code } = readableError("131005");

    expect(code).toBe("131005");
    expect(sentence).toContain("business verification");
    expect(sentence).not.toContain("131005");
  });

  it("keeps the code visible for support", () => {
    expect(readableError("133000").code).toBe("133000");
  });

  it.each(["0", "10", "100", "190", "200", "131042", "133005"])(
    "has a sentence for %s",
    (code) => {
      const { sentence } = readableError(code);
      expect(sentence.length).toBeGreaterThan(20);
      expect(sentence).not.toContain("#");
    },
  );

  it("falls back without leaking the provider wording", () => {
    const { sentence, code } = readableError(
      "999999",
      "(#999999) Unknown error",
    );

    expect(sentence).not.toContain("#999999");
    expect(sentence).not.toContain("Unknown error");
    expect(code).toBe("999999");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace", "   "],
  ])("handles a %s code", (_label, code) => {
    const result = readableError(code);
    expect(result.sentence.length).toBeGreaterThan(20);
    expect(result.code).toBeNull();
  });

  it("reports an unknown code when only a message is given", () => {
    expect(readableError(null, "something broke").code).toBe("unknown");
  });

  it("never returns an empty sentence", () => {
    for (const code of ["1", "abc", "", "131005"]) {
      expect(readableError(code).sentence.trim()).not.toBe("");
    }
  });
});
