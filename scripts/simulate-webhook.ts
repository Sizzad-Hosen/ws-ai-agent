import "dotenv/config";

import { createHmac } from "node:crypto";

/**
 * Posts a correctly signed WhatsApp webhook delivery at the local app.
 *
 * The whole point is to exercise the endpoint without Meta: business
 * verification and App Review take days, and none of the routing, dedupe or
 * signature logic needs them. It signs with META_APP_SECRET exactly as Meta
 * does, so a delivery that this accepts is one Meta would have produced.
 *
 * Usage:
 *   npm run whatsapp:simulate                      one text message
 *   npm run whatsapp:simulate -- --kind status     a delivery receipt
 *   npm run whatsapp:simulate -- --kind batch      two entries, three changes
 *   npm run whatsapp:simulate -- --kind unsigned   a bad signature
 *   npm run whatsapp:simulate -- --verify          the GET handshake
 *
 *   --fresh        new ids each run, for generating traffic
 *   --phone <id>   the phone_number_id to route on, default PN_TEST_1
 *   --url <url>    default http://localhost:3000/api/webhooks/whatsapp
 */

interface Options {
  readonly url: string;
  readonly phoneNumberId: string;
  readonly kind: string;
  readonly verify: boolean;
  /** Message ids that change every run, for filling the table with traffic. */
  readonly fresh: boolean;
}

function readOptions(): Options {
  const argv = process.argv.slice(2);

  const value = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  return {
    url: value(
      "--url",
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhooks/whatsapp`,
    ),
    phoneNumberId: value("--phone", "PN_TEST_1"),
    kind: value("--kind", "message"),
    verify: argv.includes("--verify"),
    fresh: argv.includes("--fresh"),
  };
}

function metadata(phoneNumberId: string) {
  return {
    display_phone_number: "15550000000",
    phone_number_id: phoneNumberId,
  };
}

function textMessage(id: string, body: string) {
  return {
    from: "8801711000101",
    id,
    timestamp: "1757740000",
    type: "text",
    text: { body },
  };
}

function buildPayload(options: Options): unknown {
  // Stable by default. Timestamped ids would make every delivery unique, so
  // re-running would never touch uq_webhook_events_dedupe_hash — and the one
  // thing worth testing here is that a redelivery stores nothing.
  const stamp = options.fresh ? String(Date.now()) : "fixed";

  const second = options.fresh ? Math.floor(Date.now() / 1000) : 1757740000;

  if (options.kind === "status") {
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: metadata(options.phoneNumberId),
                statuses: [
                  {
                    id: `wamid.sim.${stamp}`,
                    status: "delivered",
                    timestamp: String(second),
                    recipient_id: "8801711000101",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  if (options.kind === "batch") {
    // Two entries, and one of them carries two changes. A handler that reads
    // entry[0].changes[0] stores one event out of four.
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_TEST_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: metadata(options.phoneNumberId),
                messages: [
                  textMessage(`wamid.sim.${stamp}.a`, "first"),
                  textMessage(`wamid.sim.${stamp}.b`, "second"),
                ],
              },
            },
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: metadata(options.phoneNumberId),
                statuses: [
                  {
                    id: `wamid.sim.${stamp}.a`,
                    status: "read",
                    timestamp: String(second),
                    recipient_id: "8801711000101",
                  },
                ],
              },
            },
          ],
        },
        {
          id: "WABA_TEST_2",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: metadata(`${options.phoneNumberId}_OTHER`),
                messages: [textMessage(`wamid.sim.${stamp}.c`, "other number")],
              },
            },
          ],
        },
      ],
    };
  }

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_TEST_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: metadata(options.phoneNumberId),
              contacts: [
                {
                  profile: { name: "Simulated Customer" },
                  wa_id: "8801711000101",
                },
              ],
              messages: [
                textMessage(`wamid.sim.${stamp}`, "Do you have this in stock?"),
              ],
            },
          },
        ],
      },
    ],
  };
}

async function runVerify(options: Options): Promise<void> {
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

  if (!token) {
    console.error(
      "META_WEBHOOK_VERIFY_TOKEN is not set, so GET will answer 503.",
    );
  }

  const url = new URL(options.url);
  url.searchParams.set("hub.mode", "subscribe");
  url.searchParams.set("hub.verify_token", token);
  url.searchParams.set("hub.challenge", "challenge-12345");

  const response = await fetch(url, { method: "GET" });
  const body = await response.text();

  console.info(`GET  ${response.status}  body: ${JSON.stringify(body)}`);
  console.info(
    body === "challenge-12345"
      ? "The handshake passed: the challenge was echoed."
      : "The handshake did NOT echo the challenge.",
  );
}

async function runPost(options: Options): Promise<void> {
  const secret = process.env.META_APP_SECRET ?? "";
  const rawBody = JSON.stringify(buildPayload(options));

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options.kind === "unsigned") {
    // Deliberately wrong, to prove the route still answers 200 and records it.
    headers["x-hub-signature-256"] = "sha256=" + "0".repeat(64);
  } else if (secret) {
    headers["x-hub-signature-256"] =
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  } else {
    console.error(
      "META_APP_SECRET is not set. The delivery will be sent unsigned and " +
        "recorded as unverified, which is itself a useful thing to see.",
    );
  }

  const started = Date.now();
  const response = await fetch(options.url, {
    method: "POST",
    headers,
    body: rawBody,
  });
  const elapsed = Date.now() - started;

  console.info(
    `POST ${response.status} in ${elapsed}ms  kind=${options.kind} ` +
      `phone_number_id=${options.phoneNumberId} bytes=${rawBody.length}`,
  );

  if (response.status !== 200) {
    console.error(
      "The route answered something other than 200. Meta retries a non-200 " +
        "and then disables the subscription for every tenant, so this is a bug.",
    );
    process.exitCode = 1;
  }

  if (elapsed > 1000) {
    console.error(
      `The route took ${elapsed}ms, over the one-second budget. Something on ` +
        "the request path is doing work that belongs in the worker.",
    );
  }
}

async function main(): Promise<void> {
  const options = readOptions();

  console.info(`→ ${options.url}`);

  if (options.verify) {
    await runVerify(options);
    return;
  }

  await runPost(options);
  console.info(
    options.fresh
      ? "Sent with fresh ids, so this is new traffic rather than a redelivery."
      : "Run it again: the ids are stable, so the second delivery should store " +
          "0 rows because uq_webhook_events_dedupe_hash refuses it.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
