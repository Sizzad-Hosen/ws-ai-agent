/**
 * The shell every outgoing email is rendered into.
 *
 * Pure and dependency-free — no `server-only`, no env, no database — so the
 * templates can be tested without a transport and so a template can never
 * quietly start depending on request state.
 *
 * One description renders both the HTML and the plain-text part. They are
 * generated from the same `EmailContent` rather than written twice, because a
 * hand-maintained text alternative is the part that silently goes stale and
 * then contradicts the HTML the reader was actually shown.
 */

/** A fact worth pulling out of a sentence, shown as a labelled row. */
export interface EmailRow {
  readonly label: string;
  readonly value: string;
}

export interface EmailAction {
  readonly label: string;
  readonly url: string;
}

export interface EmailContent {
  /** The <h1>, and the subject unless the template overrides it. */
  readonly title: string;
  /** The grey line most clients preview beside the subject. */
  readonly preheader: string;
  readonly greeting?: string;
  readonly paragraphs: readonly string[];
  readonly rows?: readonly EmailRow[];
  readonly action?: EmailAction;
  readonly closing?: string;
}

export interface RenderedEmail {
  readonly html: string;
  readonly text: string;
}

/**
 * Escapes text for interpolation into HTML.
 *
 * Every value reaching a template is attacker-controlled: a business name and
 * an owner name arrive from an unauthenticated public form, and the message
 * they land in is read by an administrator. Unescaped, `<img onerror>` in a
 * business name is markup running in a reviewer's mail client rather than a
 * company called something strange.
 *
 * The ampersand is replaced first; doing it later would re-escape the
 * ampersands introduced by the replacements before it.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * A URL safe to put in an `href`.
 *
 * Only http and https survive. `javascript:` and `data:` URLs are the reason
 * this exists: a link is the one place in an email where a scheme is obeyed,
 * and every URL here is built from configuration that a deployment controls,
 * so anything else is a mistake worth dropping rather than rendering.
 */
export function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

// Inline styles throughout, and a table for the button. Mail clients strip
// <style> blocks and support neither flexbox nor grid, so the layout rules
// that work here are the ones that worked in 2005.
const PAGE = "margin:0;padding:24px 0;background:#f4f4f5;";
const CARD =
  "max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;" +
  "padding:32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;" +
  "font-size:15px;line-height:1.6;color:#27272a;";
const HEADING =
  "margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;color:#18181b;";
const PARAGRAPH = "margin:0 0 14px;";
const LABEL =
  "padding:6px 12px 6px 0;color:#71717a;font-size:13px;vertical-align:top;" +
  "white-space:nowrap;";
const VALUE = "padding:6px 0;color:#18181b;font-size:13px;font-weight:500;";
const BUTTON =
  "display:inline-block;padding:11px 20px;border-radius:8px;background:#4f46e5;" +
  "color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;";
const FOOTER =
  "margin:24px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;" +
  "color:#71717a;font-size:12px;line-height:1.5;";
const PREHEADER =
  "display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;";

export function renderEmail(content: EmailContent): RenderedEmail {
  return { html: renderHtml(content), text: renderText(content) };
}

function renderHtml(content: EmailContent): string {
  const parts: string[] = [];

  parts.push(
    `<div style="${PREHEADER}">${escapeHtml(content.preheader)}</div>`,
  );
  parts.push(`<h1 style="${HEADING}">${escapeHtml(content.title)}</h1>`);

  if (content.greeting) {
    parts.push(`<p style="${PARAGRAPH}">${escapeHtml(content.greeting)}</p>`);
  }

  for (const paragraph of content.paragraphs) {
    parts.push(`<p style="${PARAGRAPH}">${escapeHtml(paragraph)}</p>`);
  }

  if (content.rows?.length) {
    const rows = content.rows
      .map(
        (row) =>
          `<tr><td style="${LABEL}">${escapeHtml(row.label)}</td>` +
          `<td style="${VALUE}">${escapeHtml(row.value)}</td></tr>`,
      )
      .join("");

    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" ` +
        `style="margin:20px 0;border-collapse:collapse;">${rows}</table>`,
    );
  }

  const href = content.action ? safeUrl(content.action.url) : null;

  if (content.action && href) {
    parts.push(
      `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" ` +
        `style="${BUTTON}">${escapeHtml(content.action.label)}</a></p>`,
    );
  }

  if (content.closing) {
    parts.push(`<p style="${FOOTER}">${escapeHtml(content.closing)}</p>`);
  }

  return `<div style="${PAGE}"><div style="${CARD}">${parts.join("")}</div></div>`;
}

function renderText(content: EmailContent): string {
  const blocks: string[] = [content.title];

  if (content.greeting) blocks.push(content.greeting);

  blocks.push(...content.paragraphs);

  if (content.rows?.length) {
    blocks.push(
      content.rows.map((row) => `${row.label}: ${row.value}`).join("\n"),
    );
  }

  const href = content.action ? safeUrl(content.action.url) : null;

  if (content.action && href) {
    blocks.push(`${content.action.label}: ${href}`);
  }

  if (content.closing) blocks.push(content.closing);

  // A blank line between blocks; nothing trailing, so the body ends cleanly.
  return `${blocks.join("\n\n")}\n`;
}
