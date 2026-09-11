import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableEmpty,
  TableScroller,
} from "@/components/ui/table";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { countPassedChecks } from "@/features/registrations/types";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { REVIEW_QUEUE_STATUSES } from "@/types/status";
import { formatOptionalDate } from "@/utils/format";

export const metadata: Metadata = {
  title: "Registration Review",
};

const PAGE_SIZE = 20;

export default async function RegistrationsPage({
  searchParams,
}: PageProps<"/bo/registrations">) {
  await requirePermission(PLATFORM_PERMISSIONS.TENANTS_READ);

  const params = await searchParams;
  const rawOffset = typeof params.offset === "string" ? params.offset : "";
  const parsed = Number.parseInt(rawOffset, 10);
  const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const result = await repositories.registrations.findMany({
    status: REVIEW_QUEUE_STATUSES,
    limit: PAGE_SIZE,
    offset,
  });

  function buildHref(nextOffset: number): string {
    return nextOffset > 0
      ? `${ROUTES.bo.registrations}?offset=${nextOffset}`
      : ROUTES.bo.registrations;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: ROUTES.bo.tenants },
          { label: "Registration Review" },
        ]}
        title="Registration Review"
        description="Inbound tenant registrations awaiting verification and approval."
      />

      <Card className="overflow-hidden">
        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Business</TH>
                <TH>Registration</TH>
                <TH>Owner</TH>
                <TH>Requested plan</TH>
                <TH>Region</TH>
                <TH>Checks</TH>
                <TH>Submitted</TH>
              </TR>
            </THead>
            <TBody>
              {result.items.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  title="No registrations awaiting review"
                  description="New sign-ups from the public site land here for verification."
                />
              ) : (
                result.items.map((detail) => {
                  const passed = countPassedChecks(detail.checks);
                  const complete = passed === detail.checks.length;

                  return (
                    <TR key={detail.registration.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={detail.registration.businessName}
                            size="sm"
                          />
                          <Link
                            href={ROUTES.bo.registration(
                              detail.registration.id,
                            )}
                            className="text-foreground hover:text-primary-deep font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {detail.registration.businessName}
                          </Link>
                        </div>
                      </TD>
                      <TD mono className="text-muted-foreground">
                        {detail.registration.registrationCode}
                      </TD>
                      <TD mono className="text-muted-foreground">
                        {detail.registration.ownerEmail}
                      </TD>
                      <TD>
                        {detail.requestedPlanName ? (
                          <Badge shape="tag" tone="info">
                            {detail.requestedPlanName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD>{detail.registration.region}</TD>
                      <TD>
                        <Badge tone={complete ? "success" : "warning"}>
                          {passed}/{detail.checks.length} Complete
                        </Badge>
                      </TD>
                      <TD className="text-muted-foreground">
                        {formatOptionalDate(detail.registration.submittedAt)}
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableScroller>
        <Pagination
          total={result.total}
          limit={result.limit}
          offset={result.offset}
          buildHref={buildHref}
          noun="registrations"
        />
      </Card>
    </div>
  );
}
