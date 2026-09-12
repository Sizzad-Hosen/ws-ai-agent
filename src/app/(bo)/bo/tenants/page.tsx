import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { env } from "@/config/env";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { countPassedChecks } from "@/features/registrations/types";
import { TenantFilters } from "@/features/tenants/components/tenant-filters";
import { TenantsTable } from "@/features/tenants/components/tenants-table";
import type { PendingTenantApplication } from "@/features/tenants/types";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import {
  REVIEW_QUEUE_STATUSES,
  TENANT_DISPLAY_STATUSES,
  WHATSAPP_CONNECTION_STATUSES,
  type TenantDisplayStatus,
  type WhatsappConnectionStatus,
} from "@/types/status";

export const metadata: Metadata = {
  title: "Tenants",
};

const PAGE_SIZE = 20;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampOffset(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default async function TenantsPage({
  searchParams,
}: PageProps<"/bo/tenants">) {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_READ);
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.TENANTS_MANAGE,
  );

  const params = await searchParams;
  const search = single(params.search).slice(0, 100);
  const statusParam = single(params.status);
  const planCode = single(params.plan);
  const whatsappParam = single(params.whatsapp);
  const offset = clampOffset(single(params.offset));

  // Unknown filter values are dropped rather than passed to the repository.
  const status = TENANT_DISPLAY_STATUSES.includes(
    statusParam as TenantDisplayStatus,
  )
    ? (statusParam as TenantDisplayStatus)
    : undefined;
  const whatsapp = WHATSAPP_CONNECTION_STATUSES.includes(
    whatsappParam as WhatsappConnectionStatus,
  )
    ? (whatsappParam as WhatsappConnectionStatus)
    : undefined;

  // Applications belong on this screen: a sign-up is a tenant-to-be, and a
  // queue nobody looks at is a queue nobody works. They show unfiltered and
  // under the "Pending" filter, which is what an operator means by pending.
  // Never on later pages, where they would repeat above every page of tenants.
  const showPending =
    offset === 0 && (status === undefined || status === "pending");

  const [result, plans, applications] = await Promise.all([
    repositories.tenants.findMany({
      search: search || undefined,
      status,
      planCode: planCode || undefined,
      whatsapp,
      limit: PAGE_SIZE,
      offset,
    }),
    repositories.plans.findAll(),
    showPending
      ? repositories.registrations.findMany({
          status: REVIEW_QUEUE_STATUSES,
          search: search || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        })
      : null,
  ]);

  const pending: readonly PendingTenantApplication[] = (
    applications?.items ?? []
  ).map((detail) => ({
    registrationId: detail.registration.id,
    registrationCode: detail.registration.registrationCode,
    businessName: detail.registration.businessName,
    ownerName: detail.registration.ownerName,
    ownerEmail: detail.registration.ownerEmail,
    requestedPlanName: detail.requestedPlanName,
    submittedAt: detail.registration.submittedAt,
    checksPassed: countPassedChecks(detail.checks),
    checksTotal: detail.checks.length,
  }));

  const hasFilters = Boolean(search || status || planCode || whatsapp);

  function buildHref(nextOffset: number): string {
    const query = new URLSearchParams();

    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (planCode) query.set("plan", planCode);
    if (whatsapp) query.set("whatsapp", whatsapp);
    if (nextOffset > 0) query.set("offset", String(nextOffset));

    const serialized = query.toString();
    return serialized
      ? `${ROUTES.bo.tenants}?${serialized}`
      : ROUTES.bo.tenants;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage all tenant workspaces and platform usage."
        actions={
          <>
            <Button
              variant="secondary"
              disabled
              title="Export is not implemented yet."
            >
              Export Data
            </Button>
            <Button asChild>
              <Link href={ROUTES.bo.registrations}>Registration queue</Link>
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <TenantFilters
          search={search}
          status={statusParam}
          planCode={planCode}
          whatsapp={whatsappParam}
          plans={plans.map((item) => item.plan)}
          hasFilters={hasFilters}
        />
        <TenantsTable
          items={result.items}
          appUrl={env.NEXT_PUBLIC_APP_URL}
          pending={pending}
          hasFilters={hasFilters}
          canManage={canManage}
        />
        <Pagination
          total={result.total}
          limit={result.limit}
          offset={result.offset}
          buildHref={buildHref}
          noun="results"
        />
      </Card>
    </div>
  );
}
