import type { PlanStatus } from "@/types/status";

export interface PlanLimits {
  readonly monthlyMessages: number;
  readonly adminSeats: number;
  readonly whatsappNumbers: number;
}

export interface SubscriptionPlan {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly status: PlanStatus;
  readonly monthlyPriceMinor: number;
  readonly currency: string;
  readonly limits: PlanLimits;
  readonly createdAt: string;
  readonly updatedAt: string;
}
