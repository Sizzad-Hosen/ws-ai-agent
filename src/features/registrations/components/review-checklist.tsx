import { Check, CircleAlert, Info, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  REGISTRATION_CHECK_LABELS,
  countPassedChecks,
  type RegistrationCheck,
} from "@/features/registrations/types";
import { cn } from "@/lib/utils";

interface ReviewChecklistProps {
  readonly checks: readonly RegistrationCheck[];
  readonly canManage: boolean;
}

export function ReviewChecklist({ checks, canManage }: ReviewChecklistProps) {
  const passed = countPassedChecks(checks);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-headline-sm">Review Checklist</h2>
        <Badge tone={passed === checks.length ? "success" : "neutral"}>
          {passed}/{checks.length} Complete
        </Badge>
      </div>

      <ul className="space-y-3">
        {checks.map((check) => {
          const copy = REGISTRATION_CHECK_LABELS[check.checkType];
          const isPending = check.status === "pending";
          const isFailed = check.status === "failed";

          return (
            <li
              key={check.id}
              className={cn(
                "rounded-md border p-3.5",
                check.status === "passed" &&
                  "border-border bg-success-container/30",
                isPending &&
                  "border-warning/40 bg-warning-container/40 border-l-2",
                isFailed &&
                  "border-destructive/40 bg-destructive-container/40 border-l-2",
              )}
            >
              <div className="flex items-start gap-3">
                <StatusMark status={check.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">
                    {copy.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {check.notes ?? copy.description}
                  </p>

                  {check.checkedByName && check.checkedAt ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Checked by {check.checkedByName}
                    </p>
                  ) : null}

                  {isPending && canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-warning-container text-warning-container-foreground mt-2"
                    >
                      Check Status
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-border text-muted-foreground flex items-start gap-2 border-t pt-4 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>All checks must pass before final approval.</p>
      </div>
    </div>
  );
}

function StatusMark({
  status,
}: {
  readonly status: RegistrationCheck["status"];
}) {
  if (status === "passed") {
    return (
      <span
        className="bg-success grid size-5 shrink-0 place-items-center rounded"
        role="img"
        aria-label="Passed"
      >
        <Check className="size-3.5 text-white" aria-hidden="true" />
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className="bg-destructive grid size-5 shrink-0 place-items-center rounded"
        role="img"
        aria-label="Failed"
      >
        <X className="size-3.5 text-white" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className="border-warning grid size-5 shrink-0 place-items-center rounded border-2"
      role="img"
      aria-label="Pending"
    >
      <CircleAlert className="text-warning size-3" aria-hidden="true" />
    </span>
  );
}
