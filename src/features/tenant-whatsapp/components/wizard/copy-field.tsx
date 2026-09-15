"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * A value the tenant has to paste into Meta, with a button that copies it.
 *
 * Read-only rather than disabled, so the text can still be selected by hand —
 * `navigator.clipboard` is unavailable on an insecure origin, which is exactly
 * the situation a developer is in when testing over plain http. The button
 * says so instead of doing nothing.
 *
 * The font is monospaced because the two values this renders are a URL and a
 * 64-character hex token, and a tenant comparing what they pasted against what
 * is on screen needs to be able to tell 0 from O.
 */

interface CopyFieldProps {
  readonly label: string;
  readonly value: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly id: string;
}

export function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
  id,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Insecure origin, or permission refused. Select the text instead, so
      // Ctrl+C still works.
      setFailed(true);
      document.getElementById(id)?.focus();
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="border-input bg-muted/50 focus-visible:border-ring h-11 w-full rounded-lg border px-3 font-mono text-[13px] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onCopy()}
          aria-label={label}
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {failed ? (
        <p className="text-muted-foreground text-xs">
          Your browser would not let us copy. The text is selected — press
          Ctrl+C.
        </p>
      ) : null}
    </div>
  );
}
