"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

interface SwitchProps {
  readonly label: string;
  readonly name?: string;
  readonly defaultChecked?: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly className?: string;
}

/**
 * Uncontrolled toggle backed by a hidden checkbox so it participates in normal
 * form submission (plan feature toggles, tenant-level AI allocation).
 */
export function Switch({
  label,
  name,
  defaultChecked = false,
  disabled = false,
  onCheckedChange,
  className,
}: SwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);
  const id = useId();

  function handleChange(next: boolean): void {
    setChecked(next);
    onCheckedChange?.(next);
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <input
        id={id}
        type="checkbox"
        name={name}
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => handleChange(event.target.checked)}
      />
      <label
        htmlFor={id}
        className={cn(
          "peer-focus-visible:outline-ring inline-flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked ? "bg-primary" : "bg-border-strong",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-white transition-transform",
            checked && "translate-x-4",
          )}
        />
      </label>
    </span>
  );
}

/** Read-only presentation of a toggle, for plan cards that are not editable. */
export function SwitchIndicator({
  checked,
  label,
}: {
  readonly checked: boolean;
  readonly label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-9 items-center rounded-full p-0.5",
        checked ? "bg-primary" : "bg-border-strong",
      )}
      role="img"
      aria-label={`${label}: ${checked ? "included" : "not included"}`}
    >
      <span
        className={cn(
          "size-4 rounded-full bg-white",
          checked && "translate-x-4",
        )}
      />
    </span>
  );
}
