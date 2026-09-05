import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> {
  readonly options: readonly SelectOption[];
  readonly size?: "sm" | "default";
}

export function Select({
  className,
  options,
  size = "default",
  ...props
}: SelectProps) {
  return (
    <div className="relative inline-flex w-full">
      <select
        className={cn(
          "border-input bg-card text-foreground focus-visible:border-ring w-full appearance-none rounded-md border pr-9 pl-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "h-9" : "h-10",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}
