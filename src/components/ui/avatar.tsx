import { cn } from "@/lib/utils";

const TONES = [
  "bg-success-container text-success-container-foreground",
  "bg-info-container text-info-container-foreground",
  "bg-warning-container text-warning-container-foreground",
  "bg-destructive-container text-destructive-container-foreground",
  "bg-neutral-container text-neutral-container-foreground",
] as const;

export function initialsOf(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  const [first, second] = parts;
  return `${first[0]}${second?.[0] ?? ""}`.toLocaleUpperCase();
}

/** Deterministic tone so a given tenant always keeps the same chip colour. */
function toneOf(seed: string): string {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }

  return TONES[hash % TONES.length];
}

interface AvatarProps {
  readonly name: string;
  readonly size?: "sm" | "default";
  readonly className?: string;
}

export function Avatar({ name, size = "default", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold",
        size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs",
        toneOf(name),
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
