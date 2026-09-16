"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A modal, on the browser's own `<dialog>`.
 *
 * No library. `showModal()` already gives the four things a modal has to get
 * right and that a `<div>` overlay gets wrong: focus moves into the dialog and
 * is trapped there, Escape closes it, everything behind it is inert to both
 * pointer and screen reader, and it renders in the top layer so no
 * `z-index` on an ancestor can bury it.
 *
 * Two behaviours are added because the element does not have them:
 *
 *  - **A click on the backdrop closes it.** The backdrop is the dialog's own
 *    box as far as the DOM is concerned, so the click is attributed to the
 *    element itself; comparing against the content box is how the two are told
 *    apart.
 *  - **`cancel` is routed through `onClose`.** Escape fires `cancel` and closes
 *    the element directly, so without this React's state would still say open.
 */

interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  /** Rendered left of the title. The channel mark, in practice. */
  readonly icon?: ReactNode;
  readonly closeLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  closeLabel,
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) return;

    // `showModal` throws if the dialog is already open, and `close` on a
    // closed one is a no-op — so both are guarded on the element's own state
    // rather than on the prop, which can re-run for an unrelated render.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The page must not scroll behind an open modal. `<dialog>` blocks
  // interaction but not scrolling.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Only a click on the backdrop. A click inside the content box has a
        // different target and is left alone.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "bg-card text-foreground m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg",
        "border-border backdrop:bg-foreground/40 backdrop:backdrop-blur-[2px]",
        "max-h-[calc(100vh-4rem)] overflow-y-auto",
        className,
      )}
      aria-labelledby="dialog-title"
    >
      <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <h2
              id="dialog-title"
              className="text-headline-sm text-foreground truncate"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-1 shrink-0 rounded-md p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 py-5">{children}</div>
    </dialog>
  );
}
