import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { RegistrationCheckType, RegistrationStatus } from "@/types/status";

export interface RegistrationListQuery extends ListQuery {
  readonly status?: RegistrationStatus;
}

export interface NewRegistration {
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly industry: string;
  readonly region: string;
  readonly requestedPlanId: string | null;
}

/** One reviewer verdict on one checklist item. */
export interface RegistrationCheckDecision {
  readonly registrationId: string;
  readonly checkType: RegistrationCheckType;
  /** Only a verdict: a check cannot be pushed back to "pending". */
  readonly status: "passed" | "failed";
  readonly notes: string | null;
  /** The administrator recording it, stored in `checked_by`. */
  readonly reviewerId: string;
}

export type RecordCheckOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-found" | "not-pending" };

export interface RegistrationRepository {
  findById(id: string): Promise<TenantRegistration | null>;
  findDetailById(id: string): Promise<RegistrationDetail | null>;
  findMany(
    query?: RegistrationListQuery,
  ): Promise<PaginatedResult<RegistrationDetail>>;
  countPending(): Promise<number>;
  /** True when a pending or approved registration already uses this email. */
  existsForEmail(email: string): Promise<boolean>;
  /**
   * Creates a pending registration together with its review checklist, so the
   * back-office queue never shows a registration with nothing to review.
   * Returns the generated registration code.
   */
  create(values: NewRegistration): Promise<string>;
  /**
   * Records a reviewer's verdict on one checklist item.
   *
   * Refused once the registration itself has been decided: the checklist is the
   * evidence for that decision, so it must not change afterwards.
   */
  recordCheck(decision: RegistrationCheckDecision): Promise<RecordCheckOutcome>;
}
