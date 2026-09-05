import type { Invoice, Subscription } from "@/features/subscriptions/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByTenantId(tenantId: string): Promise<Subscription | null>;
  findMany(query?: ListQuery): Promise<PaginatedResult<Subscription>>;
  findAll(): Promise<readonly Subscription[]>;
  findInvoicesByTenantId(tenantId: string): Promise<readonly Invoice[]>;
  countActive(): Promise<number>;
}
