import type { Metadata } from "next";
import { Server, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { SiteSettingsForm } from "@/features/system/components/site-settings-form";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "System Settings",
};

export default async function SystemSettingsPage() {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);
  const settings = await repositories.siteSettings.find();
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.SETTINGS_MANAGE,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Platform-wide configuration and operational status."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Signed-in administrator"
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">{admin.name}</Field>
            <Field label="Email">
              <span className="tabular">{admin.email}</span>
            </Field>
            <Field label="Role">
              <Badge tone="info" className="capitalize">
                {admin.role.replaceAll("_", " ")}
              </Badge>
            </Field>
            <Field label="Console">{APP_CONFIG.consoleName}</Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Platform configuration"
            icon={<Server className="size-4" aria-hidden="true" />}
          />
          <CardBody>
            {/*
              Maintenance mode and feature flags have no table in the ERD, so
              only the public-site settings below are editable — see §2.1 / D-32.
            */}
            <p className="text-muted-foreground text-sm">
              Maintenance mode and feature flags have no backing table in the
              master schema yet, so they cannot be set here. The public site
              settings below are stored in{" "}
              <code className="tabular">public_site_settings</code> and take
              effect immediately.
            </p>
          </CardBody>
        </Card>
      </div>

      <SiteSettingsForm defaultValues={settings} canManage={canManage} />
    </div>
  );
}
