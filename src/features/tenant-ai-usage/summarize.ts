/**
 * Pure shaping of AI usage rows into what the screen renders.
 *
 * Separated from the query so it can be tested without a database. Everything
 * here takes rows and returns figures; nothing reaches a connection.
 */

export interface UsageLogRow {
  readonly createdAt: Date;
  readonly inputTokens: bigint;
  readonly outputTokens: bigint;
  readonly estimatedCost: string | null;
  readonly status: "SUCCESS" | "ERROR" | "THROTTLED";
  readonly requestType: string;
}

export interface DailyUsagePoint {
  readonly day: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface RequestTypeShare {
  readonly requestType: string;
  readonly requests: number;
  readonly percent: number;
}

export interface TenantAiUsageSummary {
  readonly requests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  /** Percentage of requests that did not succeed, to one decimal place. */
  readonly errorRatePercent: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  /** Decimal string, matching `ai_usage_logs.estimated_cost` at 12,6. */
  readonly estimatedCost: string;
  readonly daily: readonly DailyUsagePoint[];
  readonly byRequestType: readonly RequestTypeShare[];
}

/** Days of history the screen covers. */
export const USAGE_WINDOW_DAYS = 30;

/** Scale of one unit in the micro-units costs are summed in. */
const MICROS = BigInt(1_000_000);

/**
 * Costs are summed in integer micro-units rather than as floats.
 *
 * The column is Decimal(12,6), and adding several thousand IEEE doubles drifts
 * in the sixth place — which is exactly the place this column keeps.
 */
function costToMicros(value: string | null): bigint {
  if (value === null) return BigInt(0);

  const [whole = "0", fraction = ""] = value.trim().split(".");
  const padded = (fraction + "000000").slice(0, 6);
  const negative = whole.startsWith("-");
  const magnitude =
    BigInt(whole.replace("-", "") || "0") * MICROS + BigInt(padded || "0");

  return negative ? -magnitude : magnitude;
}

function microsToDecimal(micros: bigint): string {
  const negative = micros < BigInt(0);
  const magnitude = negative ? -micros : micros;
  const whole = magnitude / MICROS;
  const fraction = (magnitude % MICROS).toString().padStart(6, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One bucket per day across the whole window, so a quiet day renders as zero
 * rather than closing the gap and implying activity that did not happen.
 */
function emptyBuckets(
  windowStart: Date,
  days: number,
): Map<string, { inputTokens: number; outputTokens: number }> {
  const buckets = new Map<
    string,
    { inputTokens: number; outputTokens: number }
  >();

  for (let index = 0; index <= days; index += 1) {
    const day = new Date(windowStart);
    day.setUTCDate(day.getUTCDate() + index);
    buckets.set(dayKey(day), { inputTokens: 0, outputTokens: 0 });
  }

  return buckets;
}

export function summarizeUsage(
  rows: readonly UsageLogRow[],
  windowStart: Date,
  days: number = USAGE_WINDOW_DAYS,
): TenantAiUsageSummary {
  const buckets = emptyBuckets(windowStart, days);
  const perType = new Map<string, number>();

  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = BigInt(0);
  let successfulRequests = 0;

  for (const row of rows) {
    const rowInput = Number(row.inputTokens);
    const rowOutput = Number(row.outputTokens);

    inputTokens += rowInput;
    outputTokens += rowOutput;
    costMicros += costToMicros(row.estimatedCost);

    if (row.status === "SUCCESS") successfulRequests += 1;

    perType.set(row.requestType, (perType.get(row.requestType) ?? 0) + 1);

    const bucket = buckets.get(dayKey(row.createdAt));
    if (bucket) {
      bucket.inputTokens += rowInput;
      bucket.outputTokens += rowOutput;
    }
  }

  const requests = rows.length;
  const failedRequests = requests - successfulRequests;

  return {
    requests,
    successfulRequests,
    failedRequests,
    errorRatePercent:
      requests === 0 ? 0 : Math.round((failedRequests / requests) * 1000) / 10,
    inputTokens,
    outputTokens,
    // The ERD records input and output only; the total is their sum, not a
    // third stored column that could disagree with them.
    totalTokens: inputTokens + outputTokens,
    estimatedCost: microsToDecimal(costMicros),
    daily: [...buckets.entries()].map(([day, value]) => ({
      day,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
    })),
    byRequestType: [...perType.entries()]
      .map(([requestType, count]) => ({
        requestType,
        requests: count,
        percent:
          requests === 0 ? 0 : Math.round((count / requests) * 1000) / 10,
      }))
      .sort((a, b) => b.requests - a.requests),
  };
}
