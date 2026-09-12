import type { Metadata } from "next";

import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroller,
} from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { listSettings } from "@/features/tenant-workspace/list-service";
import { EDITABLE_SETTING_KEYS } from "@/features/tenant-settings/definitions";
import { StoreSettingsForm } from "@/features/tenant-settings/components/store-settings-form";
import { currentSettingValues } from "@/features/tenant-settings/parse-settings";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatTimestamp } from "@/utils/format";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function TenantSettingsPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/settings">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const rows = await listSettings(tenant.db);

  // The raw JSON is what the form needs; `listSettings` serialises for display.
  const stored = await tenant.db.storeSetting.findMany({
    select: { settingKey: true, value: true },
  });

  const byKey = Object.fromEntries(
    stored.map((row) => [row.settingKey, row.value]),
  );

  // Keys the form does not own. Something else wrote them, so they are shown
  // rather than hidden — but nothing here knows what shape they should be, so
  // they are not editable.
  const other = rows.filter(
    (row) => !EDITABLE_SETTING_KEYS.has(row.settingKey),
  );

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Settings"
      description={`How ${tenant.businessName} is configured.`}
    >
      <Card>
        <CardHeader title="Workspace" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">{tenant.businessName}</Field>
          <Field label="Web address">
            <span className="font-mono text-[13px]">/{tenant.slug}</span>
          </Field>
          <Field label="Signed in as">{user.name}</Field>
          <Field label="Email">
            <span className="font-mono text-[13px]">{user.email}</span>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Store and AI agent"
          description="These are read by the AI agent when it answers a customer."
        />
        <CardBody>
          <StoreSettingsForm
            slug={tenant.slug}
            values={currentSettingValues(byKey)}
          />
        </CardBody>
      </Card>

      {other.length > 0 ? (
        <Card>
          <CardHeader
            title="Other stored settings"
            description="Written by something other than this screen, so they are shown but not editable here."
          />
          <CardBody>
            <TableScroller>
              <Table>
                <THead>
                  <TR className="hover:bg-table-header">
                    <TH>Key</TH>
                    <TH>Value</TH>
                    <TH numeric>Updated</TH>
                  </TR>
                </THead>
                <TBody>
                  {other.map((row) => (
                    <TR key={row.settingKey}>
                      <TD mono className="font-medium">
                        {row.settingKey}
                      </TD>
                      <TD className="text-muted-foreground max-w-md truncate font-mono text-xs">
                        {row.value}
                      </TD>
                      <TD
                        numeric
                        className="text-muted-foreground whitespace-nowrap"
                      >
                        {formatTimestamp(row.updatedAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroller>
          </CardBody>
        </Card>
      ) : null}
    </TenantShell>
  );
}
