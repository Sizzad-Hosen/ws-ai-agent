"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, ExternalLink, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import {
  decideRegistrationAction,
  type RegistrationDecisionResult,
} from "@/features/registrations/actions/decide-registration-action";

interface RegistrationDecisionProps {
  readonly registrationId: string;
  readonly businessName: string;
  readonly readyToApprove: boolean;
}

export function RegistrationDecision({
  registrationId,
  businessName,
  readyToApprove,
}: RegistrationDecisionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationDecisionResult | null>(null);

  function decide(decision: "approve" | "reject"): void {
    setResult(null);

    startTransition(async () => {
      const outcome = await decideRegistrationAction({
        registrationId,
        decision,
      });

      setResult(outcome);

      if (outcome.success) router.refresh();
    });
  }

  const provisioned = result?.provisioned;

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          disabled={isPending}
          onClick={() => decide("reject")}
          aria-label={`Reject ${businessName}`}
        >
          <Ban className="size-4" aria-hidden="true" />
          Reject
        </Button>
        <Button
          disabled={isPending || !readyToApprove}
          onClick={() => decide("approve")}
          aria-label={`Approve ${businessName}`}
          title={
            readyToApprove
              ? undefined
              : "All checks must pass before final approval."
          }
        >
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CircleCheck className="size-4" aria-hidden="true" />
          )}
          Approve Tenant
        </Button>
      </div>

      {result && !result.success ? (
        <p
          className="text-destructive max-w-md text-right text-sm"
          role="alert"
        >
          {result.message}
        </p>
      ) : null}

      {provisioned ? (
        <div
          className="border-success-container bg-success-container/40 w-full max-w-md rounded-md border p-4 text-left"
          role="status"
        >
          <p className="text-success-container-foreground text-sm font-medium">
            {result?.message}
          </p>
          <dl className="mt-3 space-y-1.5 text-xs">
            <Row label="Tenant ID" value={provisioned.tenantCode} />
            <Row label="Plan" value={provisioned.planName} />
            <Row label="Database" value={provisioned.databaseName} />
            <Row
              label="Site"
              value={provisioned.websiteUrl ?? "No root domain configured"}
            />
          </dl>

          {provisioned.ownerPassword ? (
            <div className="border-warning/40 bg-warning-container/40 mt-3 rounded-md border p-3">
              <p className="text-foreground text-xs font-medium">
                Owner sign-in — temporary
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                This is the shared starting password. Anyone who knows the
                owner&apos;s email can use it until they replace it, so send it
                promptly and tell them to sign in. They must set their own
                before the dashboard opens.
              </p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <Row label="Dashboard" value={provisioned.dashboardUrl} />
                <Row label="Email" value={provisioned.ownerEmail ?? "—"} />
                <Row label="Password" value={provisioned.ownerPassword} />
              </dl>
            </div>
          ) : null}

          {provisioned.databaseNote ? (
            <p className="text-destructive mt-3 text-xs">
              Database: {provisioned.databaseNote}
            </p>
          ) : null}
          <Link
            href={ROUTES.bo.tenant(provisioned.tenantId)}
            className="text-primary-deep mt-3 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          >
            Open tenant
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-foreground font-medium break-all">{value}</dd>
    </div>
  );
}
