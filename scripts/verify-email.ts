import "dotenv/config";

import net from "node:net";
import { once } from "node:events";

/**
 * Exercises the registration emails over a real SMTP conversation.
 *
 * The unit tests cover what the templates render. This covers what they
 * cannot: that a message actually leaves the process, that it is addressed to
 * the right recipient, and that what arrives at the far end is what the
 * template produced.
 *
 * It does that against a throwaway SMTP server started here, so the check is
 * deterministic and needs nothing installed. Papercut is then offered the same
 * pair of messages if one is configured, which is the part a person can look
 * at — but a missing Papercut is reported, not failed, because the pipeline
 * has already been proven by then.
 */
function check(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

interface CapturedMessage {
  readonly recipients: readonly string[];
  readonly body: string;
}

interface SmtpSink {
  readonly port: number;
  readonly close: () => Promise<void>;
}

/**
 * The smallest SMTP server nodemailer will talk to.
 *
 * Enough of RFC 5321 to accept a message and remember it: a greeting, the four
 * commands that carry an envelope, and the lone dot that ends the data. It
 * advertises no extensions, so the client stays on the plain path and there is
 * no TLS negotiation to go wrong.
 */
function startSmtpSink(captured: CapturedMessage[]): Promise<SmtpSink> {
  const server = net.createServer((socket) => {
    let recipients: string[] = [];
    let dataMode = false;
    let body = "";
    let buffer = "";

    socket.write("220 sink ESMTP ready\r\n");

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");

      // SMTP is line-oriented, and a line can straddle two TCP reads.
      for (;;) {
        const end = buffer.indexOf("\r\n");
        if (end === -1) break;

        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);

        if (dataMode) {
          if (line === ".") {
            dataMode = false;
            captured.push({ recipients, body });
            recipients = [];
            body = "";
            socket.write("250 2.0.0 Queued\r\n");
          } else {
            // Dot-stuffing: a body line starting with a dot arrives doubled.
            body += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }

        const command = line.slice(0, 4).toUpperCase();

        if (command === "EHLO" || command === "HELO") {
          socket.write("250 sink\r\n");
        } else if (command === "MAIL") {
          socket.write("250 2.1.0 Sender OK\r\n");
        } else if (command === "RCPT") {
          const match = /<([^>]*)>/.exec(line);
          if (match) recipients.push(match[1]);
          socket.write("250 2.1.5 Recipient OK\r\n");
        } else if (command === "DATA") {
          dataMode = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "QUIT") {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 2.0.0 OK\r\n");
        }
      }
    });

    socket.on("error", () => {
      // A client hanging up mid-conversation is not this script's problem.
    });
  });

  return new Promise<SmtpSink>((resolve, reject) => {
    server.once("error", reject);

    // Port 0 asks the OS for a free one, so two runs cannot collide.
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        reject(new Error("The sink did not bind a TCP port."));
        return;
      }

      resolve({
        port: address.port,
        close: async () => {
          server.close();
          await once(server, "close");
        },
      });
    });
  });
}

/** Undoes the soft line wrapping quoted-printable applies at 76 columns. */
function unwrap(body: string): string {
  return body.replaceAll("=\n", "").replaceAll("=\r\n", "");
}

/** Kept apart from the facts: only the reviewers' link is built from it. */
const REGISTRATION_ID = "11111111-2222-3333-4444-555555555555";

const FACTS = {
  registrationCode: "REG-VERIFY01",
  // Carries both an ampersand and a tag, so the escaping is exercised by the
  // bytes that actually reach a mail client and not by a unit test alone.
  businessName: 'Kettle & Co <img src=x onerror="alert(1)">',
  ownerName: "Dana Okonjo",
  ownerEmail: "applicant@ordivex.local",
  ownerPhone: "+8801700000000",
  industry: "Retail",
  region: "Dhaka",
  submittedAt: new Date("2026-09-12T08:30:00.000Z"),
};

async function main(): Promise<void> {
  // Remembered before the override below, because that is what Papercut is
  // configured as and the override is about to replace it.
  const configuredHost = process.env.SMTP_HOST ?? "";
  const configuredPort = process.env.SMTP_PORT ?? "25";

  const captured: CapturedMessage[] = [];
  const sink = await startSmtpSink(captured);

  // `env` is parsed once, when the module holding it is first imported, so the
  // sink has to be in `process.env` before anything that reads it is loaded.
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(sink.port);
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.EMAIL_REVIEW_INBOX = "reviewers@ordivex.local";

  const [{ notifyRegistrationSubmitted }, { resetEmailTransport }, templates] =
    await Promise.all([
      import("@/server/email/notify-registration"),
      import("@/server/email/transport"),
      import("@/server/email/templates/registration"),
    ]);

  try {
    const result = await notifyRegistrationSubmitted({
      registrationId: REGISTRATION_ID,
      ...FACTS,
    });

    check(result.applicant.ok, true, "the applicant's receipt was accepted");
    check(result.reviewers.ok, true, "the reviewers' alert was accepted");
    check(captured.length, 2, "two messages reached the server");

    const applicant = captured.find((message) =>
      message.recipients.includes("applicant@ordivex.local"),
    );
    const reviewers = captured.find((message) =>
      message.recipients.includes("reviewers@ordivex.local"),
    );

    if (!applicant || !reviewers) {
      throw new Error(
        `Messages went to the wrong recipients: ${JSON.stringify(
          captured.map((message) => message.recipients),
        )}`,
      );
    }

    // ---- the applicant's receipt -----------------------------------------
    const receipt = unwrap(applicant.body);

    check(
      receipt.includes("REG-VERIFY01"),
      true,
      "the receipt carries the reference the applicant will quote",
    );
    check(
      /^Subject: .*REG-VERIFY01/m.test(receipt),
      true,
      "the reference is in the subject too",
    );
    check(
      receipt.includes("/bo/registrations/"),
      false,
      "the applicant is not sent a link into the back office",
    );

    // ---- the reviewers' alert --------------------------------------------
    const alert = unwrap(reviewers.body);

    check(
      alert.includes(`/bo/registrations/${REGISTRATION_ID}`),
      true,
      "the alert links to this registration, not just the queue",
    );

    for (const field of ["Dana Okonjo", "+8801700000000", "Retail", "Dhaka"]) {
      check(alert.includes(field), true, `the alert carries ${field}`);
    }

    // ---- the hostile business name, as delivered --------------------------
    check(
      alert.includes("<img src=x"),
      false,
      "no unescaped tag survives into the delivered message",
    );
    check(
      alert.includes("&lt;img src=3Dx") || alert.includes("&lt;img src=x"),
      true,
      "the tag arrives escaped and readable",
    );

    // ---- both parts are present -------------------------------------------
    check(
      alert.includes("text/plain") && alert.includes("text/html"),
      true,
      "the message is multipart, so a plain-text client renders something",
    );

    console.log(
      "Email verified over SMTP: 2 messages delivered, the receipt carries REG-VERIFY01 and no console link, the alert links to the registration and carries every review field, a tag in the business name arrived escaped, and both text and HTML parts are present.",
    );
  } finally {
    resetEmailTransport();
    await sink.close();
  }

  // ---- and finally, the catcher a person can actually look at -------------
  if (configuredHost === "") {
    console.log(
      "SMTP_HOST is not set, so nothing was sent to a catcher. Start Papercut, then set SMTP_HOST=127.0.0.1 and SMTP_PORT=25 in .env to read these two emails in its window.",
    );
    return;
  }

  const reviewUrl = new URL(
    `/bo/registrations/${REGISTRATION_ID}`,
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ).toString();

  const nodemailer = (await import("nodemailer")).default;
  const transport = nodemailer.createTransport({
    host: configuredHost,
    port: Number(configuredPort),
    secure: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
  });

  const pair = [
    { to: FACTS.ownerEmail, ...templates.registrationReceivedEmail(FACTS) },
    {
      to: process.env.EMAIL_REVIEW_INBOX ?? "reviewers@ordivex.local",
      ...templates.registrationSubmittedEmail(FACTS, reviewUrl),
    },
  ];

  try {
    for (const message of pair) {
      await transport.sendMail({
        from: process.env.EMAIL_FROM ?? "Ordivex <no-reply@ordivex.local>",
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    }

    console.log(
      `Both emails were also delivered to ${configuredHost}:${configuredPort} — open your catcher to read them.`,
    );
  } catch (error: unknown) {
    // Not a failure: the pipeline is already proven above. This only means the
    // catcher is not running, which is worth saying plainly rather than
    // failing a check nobody asked for.
    console.log(
      `Nothing was delivered to ${configuredHost}:${configuredPort} — is Papercut running? (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  } finally {
    transport.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
