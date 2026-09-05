"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface QuerySelectProps {
  /** Search-param this control owns. */
  readonly name: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly label: string;
  /** Params reset when this one changes — pagination, typically. */
  readonly resets?: readonly string[];
  readonly size?: "sm" | "default";
  readonly className?: string;
}

/**
 * Filter control that writes its value into the URL, so every filtered view is
 * shareable and survives a reload.
 */
export function QuerySelect({
  name,
  value,
  options,
  label,
  resets = ["offset"],
  size = "default",
  className,
}: QuerySelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string): void {
    const params = new URLSearchParams(searchParams.toString());

    if (next) {
      params.set(name, next);
    } else {
      params.delete(name);
    }

    for (const key of resets) {
      params.delete(key);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <>
      <label className="sr-only" htmlFor={`filter-${name}`}>
        {label}
      </label>
      <Select
        id={`filter-${name}`}
        aria-label={label}
        value={value}
        size={size}
        options={options}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(isPending && "opacity-70", className)}
      />
    </>
  );
}
