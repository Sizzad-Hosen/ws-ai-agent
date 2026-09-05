"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CircleCheck,
  ExternalLink,
  Eye,
  LoaderCircle,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { decideTenantApprovalAction } from "@/features/tenants/actions/tenant-approval-action";

interface TenantRowActionsProps {
  readonly tenantId: string;
  readonly businessName: string;
  readonly awaitingReview: boolean;
  readonly canManage: boolean;
  /** `null` when no tenant-site template is configured (D-35). */
  readonly siteUrl: string | null;
}

export function TenantRowActions({
  tenantId,
  businessName,
  awaitingReview,
  canManage,
  siteUrl,
}: TenantRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "approve" | "reject"): void {
    setError(null);

    startTransition(async () => {
      const result = await decideTenantApprovalAction({ tenantId, decision });

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {error ? (
        <span className="text-destructive mr-1 text-xs" role="alert">
          {error}
        </span>
      ) : null}

      <Button asChild variant="secondary" size="sm">
        <Link href={ROUTES.bo.tenant(tenantId)}>
          <Eye className="size-3.5" aria-hidden="true" />
          View details
        </Link>
      </Button>

      {siteUrl ? (
        <Button asChild variant="ghost" size="sm">
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Open the ${businessName} tenant site in a new tab`}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            View site
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="No tenant site URL is configured. Set TENANT_SITE_URL_TEMPLATE to enable this."
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          View site
        </Button>
      )}

      {awaitingReview && canManage ? (
        <>
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => decide("approve")}
            aria-label={`Approve ${businessName}`}
          >
            {isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            )}
            Approve
          </Button>
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
        </>
      ) : null}
    </div>
  );
}
