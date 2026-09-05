"use client";

import { Check, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DEMO_AGENT_REPLY,
  DEMO_BEATS,
  DEMO_LEAD_MESSAGE,
  REASONING_STEPS,
  demoStateAt,
  type StepStatus,
} from "@/features/public-site/demo-script";
import { cn } from "@/lib/utils";

import { PsButton } from "./ui";
import { WhatsappMockup } from "./whatsapp-mockup";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Read the motion preference without touching state during render or in an
 * effect body — the store is the media query itself.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export function ReasoningDemo() {
  const reduced = usePrefersReducedMotion();
  const [beat, setBeat] = useState(0);
  const [runId, setRunId] = useState(0);

  const finished = beat >= DEMO_BEATS.length;

  useEffect(() => {
    if (reduced || finished) return;

    const next = DEMO_BEATS[beat];
    const timer = setTimeout(() => {
      setBeat((value) => value + 1);
    }, next?.delayMs ?? 0);

    return () => clearTimeout(timer);
  }, [beat, finished, reduced, runId]);

  // Anyone who cannot watch an animation is shown the completed result instead.
  const state = demoStateAt(reduced ? DEMO_BEATS.length : beat);
  const bubbles = [DEMO_LEAD_MESSAGE, DEMO_AGENT_REPLY].slice(
    0,
    state.messageCount,
  );
  const running = Object.values(state.steps).some(
    (status) => status === "running",
  );

  function replay(): void {
    setBeat(0);
    setRunId((value) => value + 1);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <WhatsappMockup
        bubbles={bubbles}
        typing={state.typing}
        className="min-h-[26rem]"
      />

      <div className="bg-ps-panel-soft border-ps-edge rounded-card border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ps-ink font-display text-lg font-semibold">
            Live Reasoning Engine
          </h2>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              running
                ? "bg-ps-brand-wash text-ps-brand-deep"
                : "bg-ps-panel text-ps-ink-subtle border-ps-edge border",
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {running ? "Processing" : "Idle"}
          </span>
        </div>

        <ol className="mt-5 space-y-3" aria-live="polite">
          {REASONING_STEPS.map((step) => (
            <StepPanel
              key={step.id}
              title={step.title}
              duration={step.duration}
              facts={step.facts}
              status={state.steps[step.id] ?? "pending"}
            />
          ))}
        </ol>

        {(reduced || finished) && (
          <PsButton
            variant="secondary"
            size="sm"
            className="mt-6"
            onClick={replay}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Replay
          </PsButton>
        )}
      </div>
    </div>
  );
}

function StepPanel({
  title,
  duration,
  facts,
  status,
}: {
  readonly title: string;
  readonly duration: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly status: StepStatus;
}) {
  return (
    <li
      className={cn(
        "rounded-field bg-ps-panel border px-4 py-3 transition-colors",
        status === "pending" && "border-ps-edge opacity-55",
        status === "running" && "border-ps-brand/40",
        status === "done" && "border-ps-edge border-l-ps-brand border-l-4",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-ps-ink font-display text-eyebrow uppercase">
          {title}
        </p>
        <span className="text-ps-ink-subtle tabular flex items-center gap-1.5 text-xs">
          {status === "done" ? (
            <>
              <Check className="text-ps-brand size-3.5" aria-hidden="true" />
              {duration}
            </>
          ) : status === "running" ? (
            <>
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
              Working
            </>
          ) : (
            "Pending"
          )}
        </span>
      </div>

      {status === "done" ? (
        <dl className="mt-3 space-y-1.5">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-wrap gap-x-2 text-sm">
              <dt className="text-ps-ink-muted">{fact.label}:</dt>
              <dd className="text-ps-ink bg-ps-panel-soft rounded px-1.5 font-medium">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}
