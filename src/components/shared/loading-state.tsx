import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  readonly label?: string;
  readonly className?: string;
}

export function LoadingState({
  label = "Loading content",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-48 items-center justify-center gap-3",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
