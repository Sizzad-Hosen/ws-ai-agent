import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { TenantFilters } from "@/features/tenants/components/tenant-filters";
import { TenantsTable } from "@/features/tenants/components/tenants-table";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import {
  TENANT_APPROVAL_STATUSES,
  WHATSAPP_CONNECTION_STATUSES,
  type TenantApprovalStatus,
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
  await requirePermission(PLATFORM_PERMISSIONS.TENANTS_READ);

  const params = await searchParams;
  const search = single(params.search).slice(0, 100);
  const statusParam = single(params.status);
  const planCode = single(params.plan);
  const whatsappParam = single(params.whatsapp);
  const offset = clampOffset(single(params.offset));

  // Unknown filter values are dropped rather than passed to the repository.
  const status = TENANT_APPROVAL_STATUSES.includes(
    statusParam as TenantApprovalStatus,
  )
    ? (statusParam as TenantApprovalStatus)
    : undefined;
  const whatsapp = WHATSAPP_CONNECTION_STATUSES.includes(
    whatsappParam as WhatsappConnectionStatus,
  )
    ? (whatsappParam as WhatsappConnectionStatus)
    : undefined;

  const [result, plans] = await Promise.all([
    repositories.tenants.findMany({
      search: search || undefined,
      status,
      planCode: planCode || undefined,
      whatsapp,
      limit: PAGE_SIZE,
      offset,
    }),
    repositories.plans.findAll(),
  ]);

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
            <Button variant="secondary">Export Data</Button>
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
        <TenantsTable items={result.items} hasFilters={hasFilters} />
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
