"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deletePlanAction } from "@/features/plans/actions/delete-plan-action";

interface PlanDeleteButtonProps {
  readonly planId: string;
  readonly planName: string;
  readonly activeSubscriptions: number;
}

export function PlanDeleteButton({
  planId,
  planName,
  activeSubscriptions,
}: PlanDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = activeSubscriptions > 0;

  function remove(): void {
    setError(null);

    startTransition(async () => {
      const result = await deletePlanAction({ planId });

      if (!result.success) {
        setError(result.message);
        setConfirming(false);
        return;
      }

      router.refresh();
    });
  }

  if (blocked) {
    return (
      <p className="text-muted-foreground text-center text-xs">
        Deactivate rather than delete while this plan has subscribers.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            disabled={isPending}
            onClick={remove}
            aria-label={`Confirm deletion of ${planName}`}
          >
            {isPending ? (
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
            Confirm delete
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${planName}`}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete Plan
        </Button>
      )}
    </div>
  );
}
