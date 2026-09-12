import "server-only";

import type { TenantPrismaClient } from "@/server/tenancy/tenant-prisma";

import {
  summarizeUsage,
  USAGE_WINDOW_DAYS,
  type TenantAiUsageSummary,
  type UsageLogRow,
} from "./summarize";

/**
 * A tenant's own AI usage, read from that tenant's own database.
 *
 * `ai_usage_logs` holds one row per AI call. It is operational tenant data, so
 * it lives in the tenant database and never in the master — the master keeps
 * only the `ai_usage_daily` rollup, which is the platform operator's view.
 *
 * There is no tenant filter in any query here, and that is the point: the
 * connection handed in by the guard *is* the boundary, so a tenant cannot read
 * another tenant's usage even if the caller asks for it.
 */

export interface RecentAiCall {
  readonly id: string;
  readonly requestType: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly conversationId: string | null;
}

export interface TenantAiUsage extends TenantAiUsageSummary {
  readonly windowDays: number;
  readonly recent: readonly RecentAiCall[];
}

const RECENT_LIMIT = 15;

/** Midnight UTC, `days` back. Buckets are keyed by UTC date. */
function windowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

export async function loadTenantAiUsage(
  db: TenantPrismaClient,
  days: number = USAGE_WINDOW_DAYS,
): Promise<TenantAiUsage> {
  const since = windowStart(days);

  const [rows, recent] = await Promise.all([
    db.aiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
        status: true,
        requestType: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.aiUsageLog.findMany({
      take: RECENT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestType: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
        status: true,
        createdAt: true,
        conversationId: true,
      },
    }),
  ]);

  const summary = summarizeUsage(
    rows.map((row): UsageLogRow => ({
      createdAt: row.createdAt,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCost: row.estimatedCost?.toString() ?? null,
      status: row.status,
      requestType: row.requestType,
    })),
    since,
    days,
  );

  return {
    ...summary,
    windowDays: days,
    recent: recent.map((row) => ({
      // BigInt does not survive the boundary into a Client Component.
      id: row.id.toString(),
      requestType: row.requestType,
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      estimatedCost: row.estimatedCost?.toString() ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      conversationId: row.conversationId,
    })),
  };
}
