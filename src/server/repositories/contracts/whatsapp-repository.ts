import type {
  WhatsappAccount,
  WhatsappAccountFilters,
  WhatsappSummary,
} from "@/features/whatsapp/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface WhatsappListQuery extends ListQuery, WhatsappAccountFilters {}

export interface WhatsappRepository {
  findMany(
    query?: WhatsappListQuery,
  ): Promise<PaginatedResult<WhatsappAccount>>;
  findByTenantId(tenantId: string): Promise<WhatsappAccount | null>;
  /** `null` when no source for connection health exists (§2.2 / D-10). */
  summary(): Promise<WhatsappSummary | null>;
}
