import { DatabaseZap } from "lucide-react";

import { cn } from "@/lib/utils";

interface UnavailableNoticeProps {
  readonly title: string;
  readonly description: string;
  /** Where the gap is recorded, e.g. "§2.2 / D-10". */
  readonly reference?: string;
  readonly className?: string;
}

/**
 * Shown when a screen has no data source at all, as distinct from a source
 * that returned nothing. Conflating the two is how a reporting screen ends up
 * asserting "zero activity" for something it never measured.
 */
export function UnavailableNotice({
  title,
  description,
  reference,
  className,
}: UnavailableNoticeProps) {
  return (
    <section
      className={cn(
        "bg-card border-border rounded-md border border-dashed p-8 text-center",
        className,
      )}
      role="status"
    >
      <DatabaseZap
        className="text-muted-foreground mx-auto size-8"
        aria-hidden="true"
      />
      <h2 className="text-foreground mt-3 font-semibold">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-lg text-sm">
        {description}
      </p>
      {reference ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Tracked in{" "}
          <code className="tabular">docs/IMPLEMENTATION_PLAN.md</code>{" "}
          {reference}.
        </p>
      ) : null}
    </section>
  );
}
