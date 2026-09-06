import type { Metadata } from "next";

import { ChangePasswordForm } from "@/features/tenant-dashboard/components/change-password-form";
import { TENANT_MIN_PASSWORD_LENGTH } from "@/server/tenancy/tenant-auth";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
};

export default async function ChangePasswordPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/change-password">) {
  const { tenant: slug } = await params;
  // The one page an account still on its starting password may reach.
  const { tenant, user } = await requireTenantPage(slug, {
    allowPasswordChange: true,
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="bg-card w-full max-w-[460px] rounded-2xl border p-6 shadow-xl shadow-slate-900/5 sm:p-9">
        <p className="text-primary text-sm font-semibold">
          {tenant.businessName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {user.mustChangePassword ? "Choose your password" : "Change password"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {user.mustChangePassword
            ? "Your account was created with a temporary password that others may know. Set your own before continuing."
            : "Pick a new password for your account."}
        </p>

        <ChangePasswordForm
          slug={tenant.slug}
          minLength={TENANT_MIN_PASSWORD_LENGTH}
        />
      </section>
    </main>
  );
}
