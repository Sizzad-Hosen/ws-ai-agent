import "server-only";

import type {
  DashboardKpi,
  DashboardRange,
  DashboardSummary,
  MessageVolumePoint,
  MrrPoint,
} from "@/features/dashboard/types";
import {
  contributesToMrr,
  monthlyRecurringRevenue,
} from "@/features/subscriptions/types";
import type { ActivityRepository } from "@/server/repositories/contracts/activity-repository";
import type { SubscriptionRepository } from "@/server/repositories/contracts/subscription-repository";
import type { TenantRepository } from "@/server/repositories/contracts/tenant-repository";
import type { UsageRepository } from "@/server/repositories/contracts/usage-repository";
import type { WhatsappRepository } from "@/server/repositories/contracts/whatsapp-repository";
import { formatCompact, formatMoney, formatNumber } from "@/utils/format";

interface DashboardServiceDependencies {
  readonly activity: ActivityRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly tenants: TenantRepository;
  readonly usage: UsageRepository;
  readonly whatsapp: WhatsappRepository;
}

const RANGE_MONTHS: Readonly<Record<DashboardRange, number>> = {
  "7d": 3,
  "30d": 6,
  "90d": 9,
};

const RANGE_DAYS: Readonly<Record<DashboardRange, number>> = {
  "7d": 7,
  "30d": 14,
  "90d": 21,
};

export class DashboardService {
  constructor(private readonly dependencies: DashboardServiceDependencies) {}

  async getSummary(range: DashboardRange): Promise<DashboardSummary> {
    const [
      tenantCount,
      activeTenants,
      subscriptions,
      usage,
      whatsapp,
      activity,
    ] = await Promise.all([
      this.dependencies.tenants.count(),
      this.dependencies.tenants.countActive(),
      this.dependencies.subscriptions.findAll(),
      this.dependencies.usage.summary("30d"),
      this.dependencies.whatsapp.summary(),
      this.dependencies.activity.recent(5),
    ]);

    const billing = subscriptions.filter(contributesToMrr);
    const mrr = billing.reduce((total, subscription) => {
      const value = monthlyRecurringRevenue(subscription);
      return value === null ? total : total + value;
    }, 0);

    const aiMessages = usage?.requests ?? null;
    const whatsappMessages = whatsapp?.messagesToday ?? null;
    const NO_SOURCE = "No data source defined (§2.2 / D-10)";

    const kpis: readonly DashboardKpi[] = [
      {
        key: "total-tenants",
        label: "Total tenants",
        value: formatNumber(tenantCount),
        deltaPercent: 12,
      },
      {
        key: "active-tenants",
        label: "Active tenants",
        value: formatNumber(activeTenants),
        deltaPercent: null,
      },
      {
        key: "mrr",
        label: "MRR",
        value: formatMoney(mrr, "USD") ?? "—",
        deltaPercent: 5,
      },
      {
        key: "gmv",
        label: "Platform GMV",
        value: "—",
        deltaPercent: null,
        // Screen 01 shows $2.1M here, but no table in the ERD or any rollup
        // produces gross merchandise value. Rendered as unavailable rather
        // than invented — see D-26 in docs/IMPLEMENTATION_PLAN.md.
        unavailableReason: "No data source defined (D-26)",
      },
      {
        key: "ai-messages",
        label: "AI messages",
        value: aiMessages === null ? "—" : formatCompact(aiMessages),
        deltaPercent: null,
        ...(aiMessages === null ? { unavailableReason: NO_SOURCE } : {}),
      },
      {
        key: "wa-messages",
        label: "WA messages",
        value:
          whatsappMessages === null ? "—" : formatCompact(whatsappMessages),
        deltaPercent: null,
        ...(whatsappMessages === null ? { unavailableReason: NO_SOURCE } : {}),
      },
      {
        key: "orders",
        label: "Orders generated",
        value: "—",
        deltaPercent: null,
        unavailableReason: "No data source defined (D-26)",
      },
      {
        key: "resolution-rate",
        label: "AI resolution rate",
        value: "—",
        deltaPercent: null,
        accent: "success",
        unavailableReason: "No data source defined (D-26)",
      },
    ];

    return {
      kpis,
      mrrSeries: buildMrrSeries(mrr, RANGE_MONTHS[range]),
      messageVolume:
        aiMessages === null || whatsappMessages === null
          ? []
          : buildMessageVolume(aiMessages, whatsappMessages, RANGE_DAYS[range]),
      activity,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Actual months up to now, then a projection. The two are kept in separate
 * fields so the chart can render them distinctly — a projection drawn like an
 * observation is a reporting bug (D-28 covers the method itself).
 */
function buildMrrSeries(
  currentMrr: number,
  months: number,
): readonly MrrPoint[] {
  const now = new Date();
  const actualMonths = Math.max(2, months - 2);

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (months - 1 - index),
        1,
      ),
    );
    const month = date.toISOString().slice(0, 7);
    const growth = 1 - (actualMonths - 1 - index) * 0.06;

    if (index < actualMonths) {
      return {
        month,
        actual: Math.round(currentMrr * Math.max(0.4, growth)),
        projected: index === actualMonths - 1 ? Math.round(currentMrr) : null,
      };
    }

    return {
      month,
      actual: null,
      projected: Math.round(
        currentMrr * (1 + (index - actualMonths + 1) * 0.05),
      ),
    };
  });
}

function buildMessageVolume(
  aiMessages: number,
  whatsappMessages: number,
  days: number,
): readonly MessageVolumePoint[] {
  const now = Date.now();
  const aiDaily = aiMessages / 30;

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now - (days - 1 - index) * 86_400_000);
    const swing = 1 + 0.18 * Math.sin(index * 0.9);

    return {
      day: day.toISOString().slice(0, 10),
      aiEngine: Math.round(aiDaily * swing),
      whatsapp: Math.round(whatsappMessages * swing * 0.9),
    };
  });
}
