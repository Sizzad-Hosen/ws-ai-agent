"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { ROUTES } from "@/constants/routes";
import { PUBLIC_NAV } from "@/features/public-site/navigation";
import { cn } from "@/lib/utils";

import { PsButton } from "./ui";

interface SiteHeaderProps {
  readonly brandName: string;
}

export function SiteHeader({ brandName }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === ROUTES.public.home
      ? pathname === href
      : pathname.startsWith(href);
  }

  return (
    <header className="glass-ps border-ps-edge sticky top-0 z-50 border-b">
      <div className="container-ps flex h-16 items-center justify-between gap-4">
        <Link
          href={ROUTES.public.home}
          className="text-ps-ink font-display shrink-0 text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {brandName}
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4",
                    isActive(item.href)
                      ? "text-ps-brand-deep decoration-ps-brand font-medium underline decoration-2 underline-offset-8"
                      : "text-ps-ink-muted hover:text-ps-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.public.register}
            className="text-ps-ink hover:text-ps-brand-deep hidden text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 sm:inline-flex"
          >
            Register
          </Link>
          <PsButton asChild size="sm">
            <Link href={ROUTES.public.register}>Start Free</Link>
          </PsButton>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="text-ps-ink hover:bg-ps-panel-soft rounded-field inline-flex size-10 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="public-mobile-nav"
          aria-label="Primary"
          className="border-ps-edge bg-ps-panel border-t lg:hidden"
        >
          <ul className="container-ps flex flex-col py-2">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block py-3 text-base transition-colors",
                    isActive(item.href)
                      ? "text-ps-brand-deep font-medium"
                      : "text-ps-ink-muted hover:text-ps-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
