import type { Metadata } from "next";

import { TenantLoginForm } from "@/features/tenant-dashboard/components/tenant-login-form";
import { requireTenantOnly } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Sign in",
  // A workspace sign-in page has nothing to offer a search engine.
  robots: { index: false, follow: false },
};

export default async function TenantLoginPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/login">) {
  const { tenant: slug } = await params;
  // Resolves the workspace but requires no session: this is how you get one.
  const tenant = await requireTenantOnly(slug);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="bg-card w-full max-w-[420px] rounded-2xl border p-6 shadow-xl shadow-slate-900/5 sm:p-9">
        <p className="text-primary text-sm font-semibold">
          {tenant.businessName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Manage your catalogue, customers and orders.
        </p>

        <TenantLoginForm slug={tenant.slug} />
      </section>
    </main>
  );
}
