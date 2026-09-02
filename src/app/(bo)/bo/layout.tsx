import type { ReactNode } from "react";

import { BoShell } from "@/components/layout/bo-shell";
import { requireBoAdmin } from "@/server/auth/authorization";

interface BoLayoutProps {
  readonly children: ReactNode;
}

export default async function BoLayout({ children }: BoLayoutProps) {
  const admin = await requireBoAdmin();

  return <BoShell admin={admin}>{children}</BoShell>;
}
