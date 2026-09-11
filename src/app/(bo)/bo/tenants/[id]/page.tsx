import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Database, Globe, Hash, MessageSquare, Store, Tag } from "lucide-react";

import { CopyableValue } from "@/components/shared/copyable-value";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { InfrastructurePanel } from "@/features/tenants/components/infrastructure-panel";
import {
  TENANT_APPROVAL_LABELS,
  TENANT_APPROVAL_TONES,
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
} from "@/features/tenants/status";
import { TenantRowActions } from "@/features/tenants/components/tenant-row-actions";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = {
  title: "Tenant Details",
};

export default async function TenantDetailPage({
  params,
}: PageProps<"/bo/tenants/[id]">) {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_READ);
  const { id } = await params;

  const detail = await repositories.tenants.findDetailById(id);

  if (!detail) {
    notFound();
  }

  const { tenant, planName, subscribedAt, infrastructure } = detail;
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.TENANTS_MANAGE,
  );
  // Impersonation is the highest-privilege action in the console (S-02).
  const canImpersonate = admin.role === "super_admin";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: ROUTES.bo.tenants },
          { label: "Registration Review", href: ROUTES.bo.registrations },
          { label: tenant.businessName },
        ]}
        title={tenant.businessName}
        meta={
          <>
            <Badge tone={TENANT_APPROVAL_TONES[tenant.approvalStatus]} dot>
              {TENANT_APPROVAL_LABELS[tenant.approvalStatus]}
            </Badge>
            <Badge tone={TENANT_STATUS_TONES[tenant.status]} dot>
              {TENANT_STATUS_LABELS[tenant.status]}
            </Badge>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Hash className="size-3.5" aria-hidden="true" />
              <span className="tabular">ID: {tenant.tenantCode}</span>
            </span>
            {tenant.registrationCode ? (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="size-3.5" aria-hidden="true" />
                <span className="tabular">Reg: {tenant.registrationCode}</span>
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            {/*
              Impersonation has no supporting model: it needs a scoped,
              audited, revocable grant (S-02 / D-12) and there is no table for
              one. The control stays visible but disabled and says so, rather
              than advertising a capability that silently does nothing.
            */}
            {canImpersonate ? (
              <Button
                variant="ghost"
                disabled
                title="Impersonation needs a scoped, audited grant that the schema does not model yet (S-02)."
              >
                Login as Tenant
              </Button>
            ) : null}
            {canManage ? (
              <TenantRowActions
                tenantId={tenant.id}
                businessName={tenant.businessName}
                approvalStatus={tenant.approvalStatus}
                status={tenant.status}
                websiteUrl={tenant.websiteUrl}
                canManage={canManage}
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-t-primary-container border-t-2">
            <CardHeader
              title="Registration & Technical"
              icon={<Database className="size-4" aria-hidden="true" />}
            />
            <CardBody className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="UUID">
                  <CopyableValue value={tenant.id} label="tenant UUID" />
                </Field>
                {infrastructure.database && canManage ? (
                  <Field label="Database Name">
                    <CopyableValue
                      value={infrastructure.database.databaseName}
                      label="database name"
                    />
                  </Field>
                ) : (
                  <Field label="Database Name">
                    <span className="text-muted-foreground text-[13px]">
                      Restricted
                    </span>
                  </Field>
                )}
              </div>

              <hr className="border-border" />

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Owner">
                  <span className="flex items-center gap-3">
                    <Avatar name={tenant.ownerName} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {tenant.ownerName}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {tenant.ownerEmail}
                      </span>
                    </span>
                  </span>
                </Field>

                <Field label="Applied Plan">
                  <span className="flex flex-wrap items-center gap-3">
                    {planName ? (
                      <Badge shape="tag" tone="info">
                        {planName}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No plan</span>
                    )}
                    <span className="text-muted-foreground tabular text-xs">
                      Signed up: {formatDate(subscribedAt ?? tenant.createdAt)}
                    </span>
                  </span>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Business Details"
              icon={<Store className="size-4" aria-hidden="true" />}
            />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Field label="Industry">
                <span className="inline-flex items-center gap-2">
                  <Tag
                    className="text-muted-foreground size-3.5"
                    aria-hidden="true"
                  />
                  {tenant.industry ?? "—"}
                </span>
              </Field>
              <Field label="Region">
                <span className="inline-flex items-center gap-2">
                  <Globe
                    className="text-muted-foreground size-3.5"
                    aria-hidden="true"
                  />
                  {tenant.region ?? "—"}
                </span>
              </Field>
              <Field label="WhatsApp Business API">
                {infrastructure.whatsapp ? (
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare
                      className="text-success size-3.5"
                      aria-hidden="true"
                    />
                    <span className="tabular">
                      {infrastructure.whatsapp.phoneNumber}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not connected</span>
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="pt-5">
            <InfrastructurePanel
              infrastructure={infrastructure}
              now={new Date()}
              canSeeInfrastructureIds={canManage}
              canManage={canManage}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
