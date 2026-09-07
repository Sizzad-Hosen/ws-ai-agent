"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: ReactNode;
  /** Label for the destructive action, e.g. "Delete product". */
  readonly confirmLabel: string;
  readonly isPending?: boolean;
  readonly error?: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Confirmation for an action that cannot be undone.
 *
 * Built on `<dialog>` so the browser supplies the modal semantics that are
 * easy to get wrong by hand: focus is trapped, the rest of the page is inert,
 * and Escape closes. The cancel path is the default focus, so a stray Enter
 * dismisses rather than destroys.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isPending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape and the backdrop both cancel; neither may confirm.
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !isPending) onCancel();
      }}
      className="bg-card text-foreground border-border w-[min(28rem,calc(100vw-2rem))] rounded-2xl border p-6 shadow-xl backdrop:bg-slate-900/40"
    >
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="text-muted-foreground mt-2 text-sm leading-6">
        {description}
      </div>

      {error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
          autoFocus
        >
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
