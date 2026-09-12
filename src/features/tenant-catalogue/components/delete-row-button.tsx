"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { CatalogueResult } from "@/features/tenant-catalogue/actions/category-actions";

interface DeleteRowButtonProps {
  readonly label: string;
  /** Shown before anything is deleted, and says what else it affects. */
  readonly confirmation: string;
  readonly onDelete: () => Promise<CatalogueResult>;
  /** Where to go once the row is gone. */
  readonly redirectTo: string;
}

/**
 * Two-step delete.
 *
 * The confirmation is inline rather than a modal so the consequence is read in
 * place — "its products become uncategorised" matters more than the click. A
 * refusal from the server is shown here too: some rows cannot be deleted at
 * all, and the reason is more useful than a disabled button would be.
 */
export function DeleteRowButton({
  label,
  confirmation,
  onDelete,
  redirectTo,
}: DeleteRowButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm(): void {
    setError(null);

    startTransition(async () => {
      const result = await onDelete();

      if (result.success) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      setAsking(false);
      setError(result.message);
    });
  }

  if (!asking) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {label}
        </Button>

        {error ? (
          <p className="text-destructive max-w-prose text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-destructive/40 bg-destructive-container/30 space-y-3 rounded-md border p-4">
      <p className="max-w-prose text-sm">{confirmation}</p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={isPending}
          onClick={confirm}
        >
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isPending ? "Deleting…" : "Yes, delete it"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => setAsking(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
