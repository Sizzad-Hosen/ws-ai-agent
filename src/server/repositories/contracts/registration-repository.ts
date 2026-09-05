import type {
  RegistrationDetail,
  TenantRegistration,
} from "@/features/registrations/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";
import type { RegistrationStatus } from "@/types/status";

export interface RegistrationListQuery extends ListQuery {
  readonly status?: RegistrationStatus;
}

export interface RegistrationRepository {
  findById(id: string): Promise<TenantRegistration | null>;
  findDetailById(id: string): Promise<RegistrationDetail | null>;
  findMany(
    query?: RegistrationListQuery,
  ): Promise<PaginatedResult<RegistrationDetail>>;
  countPending(): Promise<number>;
}
