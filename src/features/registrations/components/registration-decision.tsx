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
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function decide(decision: "approve" | "reject"): void {
    setResult(null);

    startTransition(async () => {
      const outcome = await decideRegistrationAction({
        registrationId,
        decision,
        ...(decision === "reject" ? { reason: reason.trim() } : {}),
      });

      setResult(outcome);

      if (outcome.success) router.refresh();
    });
  }

  // Rejecting asks for the reason first. The server rejects a blank one too,
  // so this is the courtesy and not the control.
  function onReject(): void {
    if (!rejecting) {
      setRejecting(true);
      return;
    }

    if (reason.trim() === "") return;

    decide("reject");
  }

  const provisioned = result?.provisioned;

  return (
    <div className="flex flex-col items-end gap-3">
      {rejecting ? (
        <div className="w-full max-w-md text-left">
          <label
            htmlFor="rejection-reason"
            className="text-foreground block text-sm font-medium"
          >
            Why is {businessName} being rejected?
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            required
            className="border-input mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            placeholder="Recorded against the application, and quoted to the applicant."
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          disabled={isPending || (rejecting && reason.trim() === "")}
          onClick={onReject}
          aria-label={`Reject ${businessName}`}
        >
          <Ban className="size-4" aria-hidden="true" />
          {rejecting ? "Confirm rejection" : "Reject"}
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
      <dd className="tabular text-foreground truncate font-medium">{value}</dd>
    </div>
  );
}
