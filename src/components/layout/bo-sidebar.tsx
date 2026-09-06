"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleQuestionMark, Settings } from "lucide-react";

import { APP_CONFIG, APP_MARK } from "@/config/app";
import { BO_NAVIGATION, type NavigationItem } from "@/config/bo-navigation";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface BoSidebarProps {
  /** Hrefs the signed-in admin is allowed to reach, resolved on the server. */
  readonly allowedHrefs: readonly string[];
}

function isActive(item: NavigationItem, pathname: string): boolean {
  const candidates = [item.href, ...(item.matches ?? [])];

  return candidates.some(
    (candidate) =>
      pathname === candidate || pathname.startsWith(`${candidate}/`),
  );
}

export function BoSidebar({ allowedHrefs }: BoSidebarProps) {
  const pathname = usePathname();
  const items = BO_NAVIGATION.filter((item) =>
    allowedHrefs.includes(item.href),
  );

  return (
    <aside className="bg-sidebar hidden w-60 shrink-0 flex-col md:flex">
      <div className="border-sidebar-border flex h-16 items-center gap-3 border-b px-5">
        <span className="bg-primary grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white">
          {APP_MARK}
        </span>
        <span className="min-w-0">
          <span className="text-sidebar-foreground-strong block truncate text-sm font-semibold">
            {APP_CONFIG.name}
          </span>
          <span className="text-label-md text-sidebar-muted block uppercase">
            {APP_CONFIG.consoleName}
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2" aria-label="Back office">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item, pathname);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "bg-sidebar-active text-sidebar-foreground-strong"
                      : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-foreground-strong",
                  )}
                >
                  {active ? (
                    <span
                      className="bg-primary absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-sidebar-border space-y-0.5 border-t p-2">
        <SidebarSecondary
          href={`${ROUTES.bo.system}#support`}
          icon={CircleQuestionMark}
          label="Support"
        />
        <SidebarSecondary
          href={ROUTES.bo.system}
          icon={Settings}
          label="Settings"
        />
      </div>
    </aside>
  );
}

function SidebarSecondary({
  href,
  icon: Icon,
  label,
}: {
  readonly href: string;
  readonly icon: typeof Settings;
  readonly label: string;
}) {
  return (
    <Link
      href={href}
      className="text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-foreground-strong flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
