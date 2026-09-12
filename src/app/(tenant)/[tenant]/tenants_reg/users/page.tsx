import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { TBody, TD, TH, TR, TableEmpty } from "@/components/ui/table";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { TenantListCard } from "@/features/tenant-workspace/components/tenant-list-card";
import { listUsers } from "@/features/tenant-workspace/list-service";
import { parseListParams } from "@/features/tenant-workspace/pagination";
import {
  USER_STATUS_LABELS,
  USER_STATUS_TONES,
} from "@/features/tenant-workspace/status";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import { formatDate, formatRelativeTime } from "@/utils/format";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default async function TenantUsersPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/users">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const listParams = parseListParams(await searchParams);
  const page = await listUsers(tenant.db, listParams);
  const now = new Date();

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="Users"
      description={`Staff accounts that can sign in to ${tenant.businessName}.`}
    >
      <TenantListCard
        basePath={tenantHref(tenant.slug, "users")}
        search={listParams.search}
        searchInputId="users-search"
        searchLabel="Search users by name or email"
        searchPlaceholder="Search by name or email…"
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        noun="users"
        head={
          <TR className="hover:bg-table-header">
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Status</TH>
            <TH numeric>Last sign-in</TH>
            <TH numeric>Added</TH>
          </TR>
        }
      >
        <TBody>
          {page.items.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title={
                listParams.search
                  ? "No users match this search"
                  : "No users yet"
              }
              description={
                listParams.search
                  ? "Try a different name or email address."
                  : "Staff accounts appear here once they are invited."
              }
            />
          ) : (
            page.items.map((row) => (
              <TR key={row.id}>
                <TD className="font-medium">{row.name}</TD>
                <TD mono className="text-muted-foreground">
                  {row.email}
                </TD>
                <TD>
                  <Badge tone={USER_STATUS_TONES[row.status]}>
                    {USER_STATUS_LABELS[row.status]}
                  </Badge>
                </TD>
                <TD numeric className="text-muted-foreground">
                  {row.lastLoginAt
                    ? formatRelativeTime(row.lastLoginAt, now)
                    : "Never"}
                </TD>
                <TD numeric className="text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </TenantListCard>
    </TenantShell>
  );
}
