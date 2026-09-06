"use client";

import { Bell, LogOut } from "lucide-react";
import { useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { tenantLogoutAction } from "@/features/tenant-dashboard/actions/tenant-logout-action";
import type { TenantSessionUser } from "@/server/tenancy/tenant-auth";

interface TenantHeaderProps {
  readonly slug: string;
  readonly businessName: string;
  readonly user: TenantSessionUser;
}

export function TenantHeader({ slug, businessName, user }: TenantHeaderProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <header className="bg-card border-border sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-4 sm:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <span className="bg-primary grid size-8 place-items-center rounded-md text-sm font-bold text-white">
          {businessName.charAt(0).toUpperCase()}
        </span>
        <span className="sr-only">{businessName}</span>
      </div>

      <p className="text-foreground truncate text-sm font-semibold">
        {businessName}
      </p>

      <div className="ml-auto flex items-center gap-2">
        {/*
          Notifications have no source: the tenant schema models no
          notification table, so a bell with a count would be inventing one.
          Visible and disabled, saying why, rather than silently doing nothing.
        */}
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Notifications are not implemented yet."
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>

        <span className="hidden items-center gap-2 sm:flex">
          <Avatar name={user.name} size="sm" />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-medium">
              {user.name}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {user.email}
            </span>
          </span>
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => tenantLogoutAction(slug))}
          aria-label="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
