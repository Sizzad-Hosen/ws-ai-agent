import { describe, expect, it } from "vitest";

import { escapeHtml, renderEmail, safeUrl } from "./layout";
import {
  registrationReceivedEmail,
  registrationSubmittedEmail,
  type RegistrationFacts,
} from "./registration";

const FACTS: RegistrationFacts = {
  registrationCode: "REG-ABC123",
  businessName: "Kettle & Co",
  ownerName: "Dana Okonjo",
  ownerEmail: "dana@kettle.example",
  ownerPhone: "+8801700000000",
  industry: "Retail",
  region: "Dhaka",
  submittedAt: new Date("2026-09-12T08:30:00.000Z"),
};

const REVIEW_URL = "https://console.example/bo/registrations/reg-1";

describe("escapeHtml", () => {
  it("neutralises the characters that open a tag or an attribute", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("escapes the ampersand before the entities it introduces", () => {
    // "&lt;" rather than "&amp;lt;": getting the order wrong double-escapes.
    expect(escapeHtml("Kettle & Co <b>")).toBe("Kettle &amp; Co &lt;b&gt;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Dana Okonjo")).toBe("Dana Okonjo");
  });
});

describe("safeUrl", () => {
  it("keeps http and https", () => {
    expect(safeUrl("https://console.example/bo")).toBe(
      "https://console.example/bo",
    );
    expect(safeUrl("http://localhost:3000/bo")).toBe(
      "http://localhost:3000/bo",
    );
  });

  it("rejects schemes that execute rather than navigate", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects what is not a URL at all", () => {
    expect(safeUrl("/bo/registrations")).toBeNull();
    expect(safeUrl("")).toBeNull();
  });
});

describe("renderEmail", () => {
  it("renders the same facts into both parts", () => {
    const { html, text } = renderEmail({
      title: "A title",
      preheader: "A preheader",
      paragraphs: ["A paragraph."],
      rows: [{ label: "Reference", value: "REG-1" }],
      action: { label: "Open", url: "https://example.com/x" },
    });

    for (const part of [html, text]) {
      expect(part).toContain("A title");
      expect(part).toContain("A paragraph.");
      expect(part).toContain("REG-1");
      expect(part).toContain("https://example.com/x");
    }
  });

  it("drops a link whose scheme is not http or https", () => {
    const { html, text } = renderEmail({
      title: "A title",
      preheader: "A preheader",
      paragraphs: [],
      action: { label: "Open", url: "javascript:alert(1)" },
    });

    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
  });

  it("always produces a text part, so no client renders nothing", () => {
    const { text } = renderEmail({
      title: "A title",
      preheader: "A preheader",
      paragraphs: [],
    });

    expect(text.trim()).toBe("A title");
  });
});

describe("registrationReceivedEmail", () => {
  const message = registrationReceivedEmail(FACTS);

  it("puts the reference in the subject, where support will look for it", () => {
    expect(message.subject).toContain("REG-ABC123");
  });

  it("names the applicant and their business in both parts", () => {
    expect(message.text).toContain("Dana Okonjo");
    expect(message.text).toContain("Kettle & Co");
    expect(message.html).toContain("Kettle &amp; Co");
  });

  it("does not leak the reviewer's console into the applicant's email", () => {
    expect(message.html).not.toContain("/bo/");
    expect(message.text).not.toContain("/bo/");
  });

  it("promises a review rather than an outcome", () => {
    expect(message.text).toContain("review");
    expect(message.text).not.toMatch(/approved|welcome aboard/i);
  });

  it("states the submission time unambiguously", () => {
    expect(message.text).toContain("2026-09-12 08:30 UTC");
  });
});

describe("registrationSubmittedEmail", () => {
  const message = registrationSubmittedEmail(FACTS, REVIEW_URL);

  it("identifies the applicant in the subject", () => {
    expect(message.subject).toContain("Kettle & Co");
    expect(message.subject).toContain("REG-ABC123");
  });

  it("links straight to the registration, not just the queue", () => {
    expect(message.html).toContain(REVIEW_URL);
    expect(message.text).toContain(REVIEW_URL);
  });

  it("carries every field a reviewer would open the queue to read", () => {
    for (const value of [
      "REG-ABC123",
      "Dana Okonjo",
      "dana@kettle.example",
      "+8801700000000",
      "Retail",
      "Dhaka",
    ]) {
      expect(message.text).toContain(value);
    }
  });

  it("escapes a business name carrying markup", () => {
    // The name arrives from an unauthenticated public form and is read in an
    // administrator's mail client, so this is the path that matters most.
    const hostile = registrationSubmittedEmail(
      { ...FACTS, businessName: `<img src=x onerror="alert(1)">` },
      REVIEW_URL,
    );

    expect(hostile.html).not.toContain("<img");
    expect(hostile.html).not.toContain('onerror="');
    expect(hostile.html).toContain("&lt;img src=x");
  });
});
