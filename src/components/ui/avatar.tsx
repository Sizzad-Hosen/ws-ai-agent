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
  /** Uploaded picture. Initials are used when there is none. */
  readonly src?: string | null;
  readonly size?: "sm" | "default" | "lg";
  readonly className?: string;
}

const SIZES = {
  sm: "size-7 text-[11px]",
  default: "size-9 text-xs",
  lg: "size-20 text-2xl",
} as const;

export function Avatar({
  name,
  src,
  size = "default",
  className,
}: AvatarProps) {
  const shared = cn("shrink-0 rounded-md", SIZES[size], className);

  if (src) {
    // A plain <img>: the file is our own upload at an arbitrary path, and
    // next/image would need it whitelisted for no benefit at this size.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(shared, "object-cover")}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn(
        shared,
        "grid place-items-center font-semibold",
        toneOf(name),
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
