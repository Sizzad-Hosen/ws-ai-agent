import { Bell, CircleQuestionMark, History, Menu, Search } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { APP_CONFIG, APP_MARK } from "@/config/app";
import type { BoSessionAdmin } from "@/server/auth/types";

interface BoHeaderProps {
  readonly admin: BoSessionAdmin;
  /** Unread notification count; hidden entirely when zero. */
  readonly notificationCount?: number;
}

export function BoHeader({ admin, notificationCount = 0 }: BoHeaderProps) {
  return (
    <header className="bg-card border-border sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-4 sm:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <span className="bg-primary grid size-8 place-items-center rounded-md text-sm font-bold text-white">
          {APP_MARK}
        </span>
        <span className="sr-only">{APP_CONFIG.name}</span>
      </div>

      <form
        className="relative hidden max-w-md flex-1 sm:block"
        role="search"
        action="/bo/tenants"
      >
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <label htmlFor="global-search" className="sr-only">
          Search tenants, logs and metrics
        </label>
        <input
          id="global-search"
          name="search"
          type="search"
          placeholder="Search tenants, logs…"
          className="bg-subtle border-border focus-visible:border-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            notificationCount > 0
              ? `Notifications, ${notificationCount} unread`
              : "Notifications"
          }
          className="relative"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {notificationCount > 0 ? (
            <span
              className="bg-destructive absolute top-1.5 right-1.5 size-2 rounded-full"
              aria-hidden="true"
            />
          ) : null}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Recent activity">
          <History className="size-[18px]" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Help">
          <CircleQuestionMark className="size-[18px]" aria-hidden="true" />
        </Button>

        <span
          className="bg-border mx-2 hidden h-6 w-px sm:block"
          aria-hidden="true"
        />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">{admin.name}</p>
          <p className="text-muted-foreground text-xs capitalize">
            {admin.role.replaceAll("_", " ")}
          </p>
        </div>
        <Avatar name={admin.name} className="ml-2 rounded-full" />

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-[18px]" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
