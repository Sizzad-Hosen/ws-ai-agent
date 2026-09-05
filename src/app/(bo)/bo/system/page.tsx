import type { Metadata } from "next";
import { CircleQuestionMark, Server, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { APP_CONFIG } from "@/config/app";
import { requirePermission } from "@/server/auth/authorization";

export const metadata: Metadata = {
  title: "System Settings",
};

export default async function SystemSettingsPage() {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.SETTINGS_MANAGE);

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
          <CardBody className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Maintenance mode, support contact and feature flags live in the
              master schema. No mockup defines this screen, and the backing
              tables are not part of the ERD in <code>docs/db</code>, so nothing
              is editable here yet.
            </p>
            <p className="text-muted-foreground text-sm">
              See §2.1 and D-32 in{" "}
              <code className="tabular">docs/IMPLEMENTATION_PLAN.md</code>.
            </p>
          </CardBody>
        </Card>

        <Card id="support" className="lg:col-span-2">
          <CardHeader
            title="Support"
            icon={<CircleQuestionMark className="size-4" aria-hidden="true" />}
          />
          <CardBody>
            <p className="text-muted-foreground text-sm">
              Escalation routing and the support contact address are part of the
              platform configuration described above.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
