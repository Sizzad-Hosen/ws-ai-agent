import Link from "next/link";
import { BotMessageSquare } from "lucide-react";

import { APP_CONFIG } from "@/config/app";
import { BO_NAVIGATION } from "@/config/bo-navigation";

export function BoSidebar() {
  return (
    <aside className="bg-card hidden w-64 shrink-0 border-r md:flex md:flex-col">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg">
          <BotMessageSquare className="size-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-semibold">
            {APP_CONFIG.shortName}
          </span>
          <span className="text-muted-foreground block text-xs">
            Platform admin
          </span>
        </span>
      </div>
      <nav className="flex-1 p-3" aria-label="Back-office navigation">
        <ul className="space-y-1">
          {BO_NAVIGATION.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="bg-accent text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-current="page"
                >
                  <Icon className="size-4" aria-hidden="true" />
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
