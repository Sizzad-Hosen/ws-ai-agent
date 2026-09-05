"use client";

import { Slot } from "@radix-ui/react-slot";
import { EllipsisVertical } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  /** Announced to screen readers on the trigger, e.g. "Actions for Acme". */
  readonly label: string;
  readonly children: ReactNode;
  readonly align?: "start" | "end";
}

/**
 * A single-level menu opened from a trigger button.
 *
 * Focus is moved into the menu on open and returned to the trigger on close so
 * the control is usable without a pointer; Escape, arrow keys and outside
 * clicks all dismiss it.
 */
export function DropdownMenu({
  label,
  children,
  align = "end",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // The first item takes focus on open so keyboard users land inside the menu.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      "[role='menuitem']:not([aria-disabled='true'])",
    );
    first?.focus();
  }, [open]);

  function moveFocus(delta: number): void {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        "[role='menuitem']:not([aria-disabled='true'])",
      ) ?? [],
    );
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = (index + delta + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <EllipsisVertical className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            }
          }}
          onClick={() => close(false)}
          className={cn(
            "bg-card border-border absolute top-full z-50 mt-1 min-w-52 overflow-hidden rounded-lg border py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface DropdownMenuItemProps {
  readonly children: ReactNode;
  readonly onSelect?: () => void;
  readonly disabled?: boolean;
  /** Explains why the item is unavailable; shown under the label. */
  readonly hint?: string;
  readonly tone?: "default" | "danger";
  /** Render as a child element, e.g. a `next/link` anchor. */
  readonly asChild?: boolean;
  readonly className?: string;
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled = false,
  hint,
  tone = "default",
  asChild = false,
  className,
}: DropdownMenuItemProps) {
  const Component = asChild ? Slot : "button";

  const classes = cn(
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none",
    disabled
      ? "text-muted-foreground cursor-not-allowed opacity-60"
      : tone === "danger"
        ? "text-destructive hover:bg-destructive-container focus:bg-destructive-container"
        : "text-foreground hover:bg-muted focus:bg-muted",
    className,
  );

  const body = hint ? (
    <span className="min-w-0">
      <span className="block">{children}</span>
      <span className="text-muted-foreground block text-xs">{hint}</span>
    </span>
  ) : (
    children
  );

  if (disabled) {
    return (
      <div role="menuitem" aria-disabled="true" className={classes}>
        {body}
      </div>
    );
  }

  return (
    <Component
      role="menuitem"
      tabIndex={-1}
      {...(asChild ? {} : { type: "button" as const, onClick: onSelect })}
      className={classes}
    >
      {body}
    </Component>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="bg-border my-1 h-px" />;
}
