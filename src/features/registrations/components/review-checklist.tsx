"use client";

import { useRouter } from "next/navigation";
import { Check, CircleAlert, Info, LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordCheckAction } from "@/features/registrations/actions/record-check-action";
import {
  REGISTRATION_CHECK_LABELS,
  countPassedChecks,
  type RegistrationCheck,
} from "@/features/registrations/types";
import { cn } from "@/lib/utils";

interface ReviewChecklistProps {
  readonly registrationId: string;
  readonly checks: readonly RegistrationCheck[];
  readonly canManage: boolean;
  /** The checklist is evidence for a decision, so it closes once one is made. */
  readonly isOpen: boolean;
}

export function ReviewChecklist({
  registrationId,
  checks,
  canManage,
  isOpen,
}: ReviewChecklistProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const passed = countPassedChecks(checks);
  const editable = canManage && isOpen;

  function record(
    checkType: RegistrationCheck["checkType"],
    status: "passed" | "failed",
  ): void {
    setError(null);
    setPendingType(checkType);

    startTransition(async () => {
      const outcome = await recordCheckAction({
        registrationId,
        checkType,
        status,
      });

      setPendingType(null);

      if (outcome.success) {
        router.refresh();
      } else {
        setError(outcome.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-headline-sm">Review Checklist</h2>
        <Badge tone={passed === checks.length ? "success" : "neutral"}>
          {passed}/{checks.length} Complete
        </Badge>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {checks.map((check) => {
          const copy = REGISTRATION_CHECK_LABELS[check.checkType];
          const isChecking = isPending && pendingType === check.checkType;
          const isPendingCheck = check.status === "pending";
          const isFailed = check.status === "failed";

          return (
            <li
              key={check.id}
              className={cn(
                "rounded-md border p-3.5",
                check.status === "passed" &&
                  "border-border bg-success-container/30",
                isPendingCheck &&
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

                  {/* A failed check stays actionable: a mistaken verdict, or an
                      applicant who since produced the evidence, must not leave
                      the registration permanently unapprovable. */}
                  {editable && check.status !== "passed" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => record(check.checkType, "passed")}
                        className="bg-success-container text-success-container-foreground"
                      >
                        {isChecking ? (
                          <LoaderCircle
                            className="size-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check className="size-3.5" aria-hidden="true" />
                        )}
                        Mark passed
                      </Button>
                      {isPendingCheck ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => record(check.checkType, "failed")}
                          className="text-destructive"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                          Mark failed
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-border text-muted-foreground flex items-start gap-2 border-t pt-4 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          {editable
            ? "All checks must pass before final approval. Each verdict is recorded against your account — nothing here is verified automatically."
            : "All checks must pass before final approval."}
        </p>
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
