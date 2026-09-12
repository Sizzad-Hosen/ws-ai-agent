import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { RegistrationCheckType, RegistrationStatus } from "@/types/status";

export interface RegistrationListQuery extends ListQuery {
  /**
   * One status, or any of several.
   *
   * The review queue needs the list form: `submitted` and `in_review` are both
   * awaiting a decision, and filtering on one alone hides the other.
   */
  readonly status?: RegistrationStatus | readonly RegistrationStatus[];
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

/** Identifies the row just written. */
export interface CreatedRegistration {
  readonly id: string;
  /**
   * The reference quoted to the applicant. Returned alongside the id because
   * the two are wanted together: the code goes in the receipt, and the id
   * builds the reviewer's link into the queue.
   */
  readonly registrationCode: string;
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
   */
  create(values: NewRegistration): Promise<CreatedRegistration>;
  /**
   * Records a reviewer's verdict on one checklist item.
   *
   * Refused once the registration itself has been decided: the checklist is the
   * evidence for that decision, so it must not change afterwards.
   */
  recordCheck(decision: RegistrationCheckDecision): Promise<RecordCheckOutcome>;
}
