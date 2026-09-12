import { describe, expect, it } from "vitest";

import { parseWebhookPayload } from "./parse-webhook";

function message(id: string, from = "8801711000101") {
  return {
    id,
    from,
    timestamp: "1757740000",
    type: "text",
    text: { body: "hi" },
  };
}

function status(id: string, state: string, timestamp = "1757740000") {
  return { id, status: state, timestamp, recipient_id: "8801711000101" };
}

function change(phoneNumberId: string, value: Record<string, unknown>) {
  return {
    field: "messages",
    value: {
      messaging_product: "whatsapp",
      metadata: {
        display_phone_number: "8801",
        phone_number_id: phoneNumberId,
      },
      ...value,
    },
  };
}

function payload(entries: readonly unknown[]) {
  return { object: "whatsapp_business_account", entry: entries };
}

describe("parseWebhookPayload", () => {
  it("reads one message", () => {
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [change("PN1", { messages: [message("wamid.1")] })],
        },
      ]),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phoneNumberId: "PN1",
      wabaId: "WABA1",
      kind: "message",
      eventType: "messages",
      providerEventId: "wamid.1",
    });
  });

  // The bug this module exists to prevent.
  it("reads every entry, not just the first", () => {
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [change("PN1", { messages: [message("wamid.1")] })],
        },
        {
          id: "WABA2",
          changes: [change("PN2", { messages: [message("wamid.2")] })],
        },
      ]),
    );

    expect(events.map((event) => event.providerEventId)).toEqual([
      "wamid.1",
      "wamid.2",
    ]);
    expect(events.map((event) => event.phoneNumberId)).toEqual(["PN1", "PN2"]);
  });

  it("reads every change within an entry, not just the first", () => {
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [
            change("PN1", { messages: [message("wamid.1")] }),
            change("PN2", { messages: [message("wamid.2")] }),
          ],
        },
      ]),
    );

    expect(events).toHaveLength(2);
  });

  it("reads every message in one change", () => {
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [
            change("PN1", {
              messages: [
                message("wamid.1"),
                message("wamid.2"),
                message("wamid.3"),
              ],
            }),
          ],
        },
      ]),
    );

    expect(events).toHaveLength(3);
  });

  it("reads messages and statuses from the same change", () => {
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [
            change("PN1", {
              messages: [message("wamid.1")],
              statuses: [status("wamid.0", "delivered")],
            }),
          ],
        },
      ]),
    );

    expect(events.map((event) => event.kind)).toEqual(["message", "status"]);
  });

  it("splits a batch so each event carries only its own item", () => {
    // A stored event must describe one thing. Keeping the whole delivery on
    // each row would make a worker reprocess its siblings.
    const { events } = parseWebhookPayload(
      payload([
        {
          id: "WABA1",
          changes: [
            change("PN1", {
              messages: [message("wamid.1"), message("wamid.2")],
            }),
          ],
        },
      ]),
    );

    for (const event of events) {
      const value = (event.payload as { value: { messages: unknown[] } }).value;
      expect(value.messages).toHaveLength(1);
    }
  });

  describe("dedupe hash", () => {
    it("is the same for a redelivered message", () => {
      const one = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [change("PN1", { messages: [message("wamid.1")] })],
          },
        ]),
      );
      const two = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [change("PN1", { messages: [message("wamid.1")] })],
          },
        ]),
      );

      expect(one.events[0]?.dedupeHash).toBe(two.events[0]?.dedupeHash);
    });

    it("differs between two messages", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [
              change("PN1", { messages: [message("a"), message("b")] }),
            ],
          },
        ]),
      );

      expect(events[0]?.dedupeHash).not.toBe(events[1]?.dedupeHash);
    });

    // The case a message-id-only key gets wrong: one message produces sent,
    // delivered and read, and all three must be stored.
    it("differs across the statuses of one message", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [
              change("PN1", {
                statuses: [
                  status("wamid.1", "sent", "1"),
                  status("wamid.1", "delivered", "2"),
                  status("wamid.1", "read", "3"),
                ],
              }),
            ],
          },
        ]),
      );

      const hashes = events.map((event) => event.dedupeHash);
      expect(new Set(hashes).size).toBe(3);
    });

    it("distinguishes the same message id on two different numbers", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [
              change("PN1", { messages: [message("wamid.1")] }),
              change("PN2", { messages: [message("wamid.1")] }),
            ],
          },
        ]),
      );

      expect(events[0]?.dedupeHash).not.toBe(events[1]?.dedupeHash);
    });

    it("is 64 hex characters, matching the char(64) column", () => {
      const { events } = parseWebhookPayload(
        payload([
          { id: "W", changes: [change("PN1", { messages: [message("m")] })] },
        ]),
      );

      expect(events[0]?.dedupeHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("collapses a duplicate repeated inside one delivery", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [change("PN1", { messages: [message("wamid.1")] })],
          },
          {
            id: "W",
            changes: [change("PN1", { messages: [message("wamid.1")] })],
          },
        ]),
      );

      expect(events).toHaveLength(1);
    });
  });

  describe("things that are not messages", () => {
    it("keeps an account_update, which is how a ban is announced", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "WABA1",
            changes: [
              {
                field: "account_update",
                value: {
                  metadata: { phone_number_id: "PN1" },
                  event: "ACCOUNT_VIOLATION",
                },
              },
            ],
          },
        ]),
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "unknown",
        eventType: "account_update",
      });
    });
  });

  describe("malformed input", () => {
    it.each([
      ["null", null],
      ["a string", "nonsense"],
      ["a number", 42],
      ["an array", []],
      ["an empty object", {}],
    ])("returns no events for %s", (_label, input) => {
      expect(parseWebhookPayload(input).events).toEqual([]);
    });

    it("skips a change with no phone_number_id, since it cannot be routed", () => {
      const result = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [
              { field: "messages", value: { messages: [message("wamid.1")] } },
            ],
          },
        ]),
      );

      expect(result.events).toEqual([]);
      expect(result.skipped).toBe(1);
    });

    it("survives entries that are not objects", () => {
      const result = parseWebhookPayload(payload(["nonsense", 1, null]));

      expect(result.events).toEqual([]);
      expect(result.skipped).toBe(3);
    });

    it("keeps the good events when one change in a batch is broken", () => {
      const { events } = parseWebhookPayload(
        payload([
          { id: "W", changes: ["broken"] },
          {
            id: "W",
            changes: [change("PN1", { messages: [message("wamid.1")] })],
          },
        ]),
      );

      expect(events).toHaveLength(1);
    });

    it("ignores a message entry that is not an object", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [change("PN1", { messages: ["nonsense", message("ok")] })],
          },
        ]),
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.providerEventId).toBe("ok");
    });

    it("still stores a message with no id", () => {
      const { events } = parseWebhookPayload(
        payload([
          {
            id: "W",
            changes: [
              change("PN1", { messages: [{ from: "880", type: "text" }] }),
            ],
          },
        ]),
      );

      expect(events).toHaveLength(1);
      expect(events[0]?.providerEventId).toBeNull();
      expect(events[0]?.dedupeHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
