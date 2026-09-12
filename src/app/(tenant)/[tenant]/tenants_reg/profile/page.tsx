import type { Metadata } from "next";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/tenant-dashboard/components/change-password-form";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { TenantAvatarUpload } from "@/features/tenant-profile/components/tenant-avatar-upload";
import { TenantProfileForm } from "@/features/tenant-profile/components/tenant-profile-form";
import { TENANT_MIN_PASSWORD_LENGTH } from "@/server/tenancy/tenant-auth";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default async function TenantProfilePage({
  params,
}: PageProps<"/[tenant]/tenants_reg/profile">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Your profile"
      description="Your picture, your name and your password."
    >
      <Card>
        <CardHeader title="Profile picture" />
        <CardBody>
          <TenantAvatarUpload
            slug={tenant.slug}
            name={user.name}
            avatarUrl={user.avatarUrl}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Your details" />
        <CardBody>
          <TenantProfileForm
            slug={tenant.slug}
            name={user.name}
            email={user.email}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Password"
          description="Changing it signs you out everywhere, including here."
        />
        <CardBody>
          <ChangePasswordForm
            slug={tenant.slug}
            minLength={TENANT_MIN_PASSWORD_LENGTH}
          />
        </CardBody>
      </Card>
    </TenantShell>
  );
}
