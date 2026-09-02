import Link from "next/link";
import { BotMessageSquare } from "lucide-react";

import { APP_CONFIG } from "@/config/app";
import { BO_NAVIGATION } from "@/config/bo-navigation";
import type { BoSessionAdmin } from "@/server/auth/types";

interface BoHeaderProps {
  readonly admin: BoSessionAdmin;
}

export function BoHeader({ admin }: BoHeaderProps) {
  return (
    <header className="bg-card flex min-h-16 items-center justify-between gap-4 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 md:hidden">
        <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
          <BotMessageSquare className="size-5" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold">
          {APP_CONFIG.shortName}
        </span>
      </div>
      <nav className="md:hidden" aria-label="Mobile back-office navigation">
        {BO_NAVIGATION.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto hidden text-right sm:block">
        <p className="text-sm font-medium">{admin.name}</p>
        <p className="text-muted-foreground text-xs">
          {admin.role.replaceAll("_", " ")} · Master workspace
        </p>
      </div>
    </header>
  );
}
