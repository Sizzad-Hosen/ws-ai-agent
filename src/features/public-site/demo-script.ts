import type { MockBubble } from "./components/whatsapp-mockup";

/**
 * The scripted demo shown on /demo.
 *
 * It is a fixed transcript, not a live model call: the page is public and
 * unauthenticated, so a real inference endpoint here would be an open,
 * bill-per-visit surface with no way to rate limit an anonymous visitor
 * meaningfully. The script mirrors what the agent genuinely does.
 */

export interface ReasoningFact {
  readonly label: string;
  readonly value: string;
}

export interface ReasoningStep {
  readonly id: string;
  readonly title: string;
  readonly facts: readonly ReasoningFact[];
  /** Wall time the real pipeline would report for this stage. */
  readonly duration: string;
}

export const REASONING_STEPS: readonly ReasoningStep[] = [
  {
    id: "intent",
    title: "Step 1: Intent parsing",
    duration: "0.12s",
    facts: [
      { label: "Extracted Entity", value: "ErgoPro X" },
      { label: "Extracted Quantity", value: "50" },
      { label: "Timeline Intent", value: "Next Tuesday (Urgent)" },
    ],
  },
  {
    id: "catalog",
    title: "Step 2: Catalog sync",
    duration: "0.34s",
    facts: [
      { label: "Matched SKU", value: "ERG-PRO-X-BLK" },
      { label: "On Hand", value: "68 units" },
      { label: "Lead Time", value: "2 business days" },
    ],
  },
  {
    id: "pricing",
    title: "Step 3: Pricing & terms",
    duration: "0.21s",
    facts: [
      { label: "Volume Tier", value: "50+ units" },
      { label: "Unit Price", value: "$284.00" },
      { label: "Delivery", value: "Mon 22nd — ahead of deadline" },
    ],
  },
];

export const DEMO_LEAD_MESSAGE: MockBubble = {
  id: "lead-chairs",
  from: "lead",
  text: "Hi, I'm looking for 50 ergonomic office chairs for our new branch. Do you have the 'ErgoPro X' in black? Need them by next Tuesday.",
};

export const DEMO_AGENT_REPLY: MockBubble = {
  id: "agent-quote",
  from: "agent",
  text: "Yes — the ErgoPro X in black is in stock, 68 units on hand. At 50 units you qualify for volume pricing at $284.00 each, and delivery lands Monday the 22nd, a day ahead of your deadline. Shall I hold the stock and send the quote?",
};

/**
 * One beat of the animation. Deriving the visible state by folding beats up to
 * an index keeps "jump to the end" (reduced motion, or the replay control)
 * exactly equal to having played every beat.
 */
export type DemoBeat =
  | { readonly kind: "message"; readonly delayMs: number }
  | { readonly kind: "typing"; readonly delayMs: number; readonly on: boolean }
  | {
      readonly kind: "step";
      readonly delayMs: number;
      readonly stepId: string;
      readonly status: "running" | "done";
    };

export const DEMO_BEATS: readonly DemoBeat[] = [
  { kind: "message", delayMs: 400 },
  { kind: "typing", delayMs: 500, on: true },
  { kind: "step", delayMs: 500, stepId: "intent", status: "running" },
  { kind: "step", delayMs: 900, stepId: "intent", status: "done" },
  { kind: "step", delayMs: 300, stepId: "catalog", status: "running" },
  { kind: "step", delayMs: 1100, stepId: "catalog", status: "done" },
  { kind: "step", delayMs: 300, stepId: "pricing", status: "running" },
  { kind: "step", delayMs: 1000, stepId: "pricing", status: "done" },
  { kind: "typing", delayMs: 400, on: false },
  { kind: "message", delayMs: 0 },
];

export type StepStatus = "pending" | "running" | "done";

export interface DemoState {
  readonly messageCount: number;
  readonly typing: boolean;
  readonly steps: Readonly<Record<string, StepStatus>>;
}

/** Folds the first `count` beats into the state they produce. */
export function demoStateAt(count: number): DemoState {
  const steps: Record<string, StepStatus> = {};
  for (const step of REASONING_STEPS) steps[step.id] = "pending";

  let messageCount = 0;
  let typing = false;

  for (const beat of DEMO_BEATS.slice(0, count)) {
    if (beat.kind === "message") messageCount += 1;
    else if (beat.kind === "typing") typing = beat.on;
    else steps[beat.stepId] = beat.status;
  }

  return { messageCount, typing, steps };
}
