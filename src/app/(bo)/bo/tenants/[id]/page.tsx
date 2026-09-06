import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Database,
  ExternalLink,
  Globe,
  Hash,
  LayoutDashboard,
  MessageSquare,
  Store,
  Tag,
} from "lucide-react";

import { CopyableValue } from "@/components/shared/copyable-value";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { env } from "@/config/env";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { tenantWorkspaceUrls } from "@/features/tenant-dashboard/routes";
import { ROUTES } from "@/constants/routes";
import { InfrastructurePanel } from "@/features/tenants/components/infrastructure-panel";
import {
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
  // Built from the slug rather than stored: one address, derived in one place,
  // so it cannot drift from the route that actually serves it.
  const workspace = tenant.subdomain
    ? tenantWorkspaceUrls(env.NEXT_PUBLIC_APP_URL, tenant.subdomain)
    : null;
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
          <Badge tone={TENANT_STATUS_TONES[tenant.approvalStatus]} dot>
            {TENANT_STATUS_LABELS[tenant.approvalStatus]}
          </Badge>
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
                status={tenant.approvalStatus}
                websiteUrl={tenant.websiteUrl}
                dashboardUrl={workspace?.dashboard ?? null}
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
              title="Workspace"
              icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
            />
            <CardBody className="space-y-6">
              {workspace ? (
                <>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Dashboard">
                      <a
                        href={workspace.dashboard}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary-deep inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {workspace.dashboard}
                        <ExternalLink
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    </Field>
                    <Field label="Sign-in">
                      <a
                        href={workspace.login}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary-deep inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {workspace.login}
                        <ExternalLink
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    </Field>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Storefront">
                      {tenant.websiteUrl ? (
                        <a
                          href={tenant.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary-deep inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {tenant.websiteUrl}
                          <ExternalLink
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-[13px]">
                          No site URL on file
                        </span>
                      )}
                    </Field>
                    <Field label="Address">
                      <CopyableValue
                        value={tenant.subdomain ?? ""}
                        label="workspace address"
                      />
                    </Field>
                  </div>
                </>
              ) : (
                /* No slug means provisioning never assigned one, so there is
                   no workspace to link to — a link built anyway would 404. */
                <p className="text-muted-foreground text-[13px]">
                  This tenant has no workspace address yet. It is assigned when
                  the tenant is provisioned.
                </p>
              )}
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
