import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { RegistrationStatus } from "@/types/status";

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
}
