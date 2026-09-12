import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BoShell } from "@/components/layout/bo-shell";
import { BO_NAVIGATION } from "@/config/bo-navigation";
import { hasPermission, requireBoAdmin } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

/** The console must never be indexed; the public site sets its own robots. */
export const metadata: Metadata = {
  title: { default: "Back Office", template: "%s | Back Office" },
  robots: { index: false, follow: false },
};

interface BoLayoutProps {
  readonly children: ReactNode;
}

export default async function BoLayout({ children }: BoLayoutProps) {
  const admin = await requireBoAdmin();

  // The session carries only what identifies the administrator; the picture
  // lives on the row, so the header reads it here.
  const profile = await repositories.admins.findById(admin.id);

  const allowedHrefs = BO_NAVIGATION.filter((item) =>
    hasPermission(admin.role, item.permission),
  ).map((item) => item.href);

  return (
    <BoShell
      admin={admin}
      avatarUrl={profile?.avatarUrl ?? null}
      allowedHrefs={allowedHrefs}
    >
      {children}
    </BoShell>
  );
}
