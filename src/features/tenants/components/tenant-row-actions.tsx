"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CircleCheck,
  ExternalLink,
  Eye,
  LayoutDashboard,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { useState, useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import {
  decideTenantStatusAction,
  type TenantDecision,
} from "@/features/tenants/actions/tenant-status-action";
import type { TenantApprovalStatus, TenantStatus } from "@/types/status";

interface TenantRowActionsProps {
  readonly tenantId: string;
  readonly businessName: string;
  readonly approvalStatus: TenantApprovalStatus;
  readonly status: TenantStatus;
  readonly websiteUrl: string | null;
  /** Absolute dashboard URL, or null before provisioning assigns an address. */
  readonly dashboardUrl: string | null;
  readonly canManage: boolean;
}

export function TenantRowActions({
  tenantId,
  businessName,
  approvalStatus,
  status,
  websiteUrl,
  dashboardUrl,
  canManage,
}: TenantRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: TenantDecision): void {
    setError(null);

    startTransition(async () => {
      const result = await decideTenantStatusAction({ tenantId, decision });

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  // Approving reads the verdict column; suspending reads the lifecycle one.
  const awaitingReview = approvalStatus === "pending_review";
  const canSuspend = status === "active" || status === "trial";
  const canReactivate = status === "suspended";
  const hasLifecycleAction =
    canManage && (awaitingReview || canSuspend || canReactivate);

  return (
    <div className="flex items-center justify-end gap-2">
      {error ? (
        <span className="text-destructive max-w-56 text-xs" role="alert">
          {error}
        </span>
      ) : null}

      <DropdownMenu label={`Actions for ${businessName}`}>
        <DropdownMenuItem asChild>
          <Link href={ROUTES.bo.tenant(tenantId)}>
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            View details
          </Link>
        </DropdownMenuItem>

        {dashboardUrl ? (
          <DropdownMenuItem asChild>
            <a href={dashboardUrl} target="_blank" rel="noreferrer noopener">
              <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
              Open dashboard
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled hint="No workspace address yet">
            <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
            Open dashboard
          </DropdownMenuItem>
        )}

        {websiteUrl ? (
          <DropdownMenuItem asChild>
            <a href={websiteUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
              View public site
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled hint="No site URL on file">
            <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
            View public site
          </DropdownMenuItem>
        )}

        {hasLifecycleAction ? <DropdownMenuSeparator /> : null}

        {canManage && awaitingReview ? (
          <>
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => decide("approve")}
            >
              <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              tone="danger"
              disabled={isPending}
              onSelect={() => decide("reject")}
            >
              <Ban className="size-4 shrink-0" aria-hidden="true" />
              Reject
            </DropdownMenuItem>
          </>
        ) : null}

        {canManage && canSuspend ? (
          <DropdownMenuItem
            tone="danger"
            disabled={isPending}
            onSelect={() => decide("suspend")}
          >
            <PauseCircle className="size-4 shrink-0" aria-hidden="true" />
            Suspend
          </DropdownMenuItem>
        ) : null}

        {canManage && canReactivate ? (
          <DropdownMenuItem
            disabled={isPending}
            onSelect={() => decide("reactivate")}
          >
            <PlayCircle className="size-4 shrink-0" aria-hidden="true" />
            Reactivate
          </DropdownMenuItem>
        ) : null}
      </DropdownMenu>
    </div>
  );
}
