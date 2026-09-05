"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface CopyableValueProps {
  readonly value: string;
  readonly label: string;
  readonly className?: string;
}

/**
 * Screen 04 renders the tenant UUID and database name in a bordered field with
 * a copy affordance.
 */
export function CopyableValue({ value, label, className }: CopyableValueProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the value stays selectable by hand.
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-subtle border-border flex items-start justify-between gap-2 rounded-md border px-3 py-2",
        className,
      )}
    >
      <span className="tabular min-w-0 text-[13px] break-all">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground shrink-0 rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
      >
        {copied ? (
          <Check className="text-success size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
