import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { BoLoginCard } from "@/features/auth/components/bo-login-card";
import { getCurrentBoAdmin } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Admin sign in",
  // Sits outside the (bo) group, so it needs its own opt-out.
  robots: { index: false, follow: false },
};

export default async function BoLoginPage() {
  const admin = await getCurrentBoAdmin();

  if (admin) {
    redirect(ROUTES.bo.dashboard);
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-100/70 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-emerald-100/50 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full">
        <BoLoginCard />
      </div>
    </main>
  );
}
