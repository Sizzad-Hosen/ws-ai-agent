import type { ReactNode } from "react";

/**
 * Shell for a tenant's dashboard.
 *
 * Only the frame lives here. The guard runs per page rather than in this
 * layout, because a Next.js layout does not re-run on every navigation and an
 * authorisation check that can be skipped is not one. The login and
 * unavailable pages share this shell and require no session.
 */
export default function TenantDashboardLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col font-sans">
      {children}
    </div>
  );
}
