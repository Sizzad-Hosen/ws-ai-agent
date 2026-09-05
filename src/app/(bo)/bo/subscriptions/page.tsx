import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import {
  monthlyRecurringRevenue,
  type Subscription,
} from "@/features/subscriptions/types";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import type { SubscriptionStatus } from "@/types/status";
import { formatDate, formatMoney } from "@/utils/format";

export const metadata: Metadata = {
  title: "Subscriptions",
};

const STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
};

const STATUS_TONES: Readonly<Record<SubscriptionStatus, BadgeTone>> = {
  trialing: "warning",
  active: "success",
  past_due: "danger",
  canceled: "neutral",
  expired: "neutral",
};

export default async function SubscriptionsPage() {
  await requirePermission(PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ);

  const [subscriptions, plans, tenants] = await Promise.all([
    repositories.subscriptions.findAll(),
    repositories.plans.findAll(),
    repositories.tenants.findMany({ limit: 100 }),
  ]);

  const planNames = new Map(
    plans.map((item) => [item.plan.id, item.plan.name]),
  );
  const tenantNames = new Map(
    tenants.items.map((item) => [item.tenant.id, item.tenant.businessName]),
  );

  function mrrOf(subscription: Subscription): string {
    const value = monthlyRecurringRevenue(subscription);
    return value === null
      ? "Negotiated"
      : (formatMoney(value, subscription.currency) ?? "—");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Commercial", href: ROUTES.bo.plans },
          { label: "Subscriptions" },
        ]}
        title="Subscriptions"
        description="Tenant subscriptions, billing cycle and normalised recurring revenue."
      />

      <Card className="overflow-hidden">
        <TableScroller>
          <Table>
            <THead>
              <TR className="hover:bg-table-header">
                <TH>Tenant</TH>
                <TH>Plan</TH>
                <TH>Cycle</TH>
                <TH>Status</TH>
                <TH numeric>MRR</TH>
                <TH>Current period</TH>
              </TR>
            </THead>
            <TBody>
              {subscriptions.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  title="No subscriptions yet"
                  description="Subscriptions are created when a registration is approved."
                />
              ) : (
                subscriptions.map((subscription) => (
                  <TR key={subscription.id}>
                    <TD>
                      <Link
                        href={ROUTES.bo.tenant(subscription.tenantId)}
                        className="text-foreground hover:text-primary-deep font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {tenantNames.get(subscription.tenantId) ?? "Unknown"}
                      </Link>
                    </TD>
                    <TD>
                      <Badge shape="tag" tone="info">
                        {planNames.get(subscription.planId) ?? "Unknown"}
                      </Badge>
                    </TD>
                    <TD className="capitalize">{subscription.billingCycle}</TD>
                    <TD>
                      <Badge tone={STATUS_TONES[subscription.status]}>
                        {STATUS_LABELS[subscription.status]}
                      </Badge>
                    </TD>
                    <TD numeric>{mrrOf(subscription)}</TD>
                    <TD mono className="text-muted-foreground">
                      {formatDate(subscription.currentPeriodStart)} –{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableScroller>
      </Card>

      <p className="text-muted-foreground text-xs">
        No mockup exists for this screen (D-22). Columns follow the
        `subscriptions` table in the ERD; annual cycles are normalised to a
        monthly figure so this page and the dashboard agree.
      </p>
    </div>
  );
}
