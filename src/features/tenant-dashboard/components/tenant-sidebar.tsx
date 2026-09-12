"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TENANT_NAVIGATION } from "@/features/tenant-dashboard/navigation";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { cn } from "@/lib/utils";

interface TenantSidebarProps {
  readonly slug: string;
  readonly businessName: string;
}

export function TenantSidebar({ slug, businessName }: TenantSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar hidden w-60 shrink-0 flex-col md:flex">
      <div className="border-sidebar-border flex h-16 items-center gap-3 border-b px-5">
        <span className="bg-primary grid size-8 shrink-0 place-items-center rounded-md text-sm font-bold text-white">
          {businessName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="text-sidebar-foreground-strong block truncate text-sm font-semibold">
            {businessName}
          </span>
          <span className="text-sidebar-foreground block truncate text-xs">
            Workspace
          </span>
        </span>
      </div>

      <nav aria-label="Workspace" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {TENANT_NAVIGATION.map((item) => {
            const href = tenantHref(slug, item.segment);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <li key={item.segment}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground-strong font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
