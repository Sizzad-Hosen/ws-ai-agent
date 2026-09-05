import type { MessageFeed, MessageFilters } from "@/features/messages/types";
import type { ListQuery } from "@/types/repository";

export interface MessageListQuery extends ListQuery, MessageFilters {}

export interface MessageRepository {
  /** `null` when no message store is configured (§2.2 / D-11). */
  findMany(query?: MessageListQuery): Promise<MessageFeed | null>;
  /** Distinct tenants that have message traffic, for the Tenant filter. */
  listTenantOptions(): Promise<readonly { id: string; name: string }[]>;
}
