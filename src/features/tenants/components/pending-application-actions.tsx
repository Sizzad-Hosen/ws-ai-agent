"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, ListChecks, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { decideRegistrationAction } from "@/features/registrations/actions/decide-registration-action";

interface PendingApplicationActionsProps {
  readonly registrationId: string;
  readonly businessName: string;
  readonly checksPassed: number;
  readonly checksTotal: number;
}

/**
 * Approve / Reject for an application, on the tenants list.
 *
 * Approve only appears once every verification check has passed, because the
 * server refuses it otherwise — screen 03's rule, enforced there too. Until
 * then the control is a link into the checklist showing how far it has got, so
 * the row says what is needed rather than offering a button that fails.
 */
export function PendingApplicationActions({
  registrationId,
  businessName,
  checksPassed,
  checksTotal,
}: PendingApplicationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ready = checksTotal > 0 && checksPassed === checksTotal;

  function decide(decision: "approve" | "reject"): void {
    setError(null);

    startTransition(async () => {
      const outcome = await decideRegistrationAction({
        registrationId,
        decision,
      });

      if (outcome.success) {
        router.refresh();
      } else {
        setError(outcome.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={isPending}
          onClick={() => decide("reject")}
          aria-label={`Reject ${businessName}`}
        >
          <Ban className="size-3.5" aria-hidden="true" />
          Reject
        </Button>

        {ready ? (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => decide("approve")}
            aria-label={`Approve ${businessName}`}
          >
            {isPending ? (
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            )}
            Approve
          </Button>
        ) : (
          <Button variant="secondary" size="sm" asChild>
            <Link
              href={ROUTES.bo.registration(registrationId)}
              aria-label={`Review ${businessName}, ${checksPassed} of ${checksTotal} checks passed`}
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              Review {checksPassed}/{checksTotal}
            </Link>
          </Button>
        )}
      </div>

      {error ? (
        <p
          className="text-destructive max-w-xs text-right text-xs"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
