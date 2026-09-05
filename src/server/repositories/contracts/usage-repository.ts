import type { UsageSummary, UsageTimeframe } from "@/features/usage/types";

export interface UsageRepository {
  /** `null` when no usage rollups exist (§2.2 / D-10). */
  summary(timeframe: UsageTimeframe): Promise<UsageSummary | null>;
  /** Platform-wide tokens consumed in the current billing window. */
  currentTokenUsage(): Promise<{ tokens: number; asOf: string } | null>;
}
