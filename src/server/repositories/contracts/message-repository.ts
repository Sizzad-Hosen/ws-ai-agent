import type { MessageFeed, MessageFilters } from "@/features/messages/types";
import type { ListQuery } from "@/types/repository";

export interface MessageListQuery extends ListQuery, MessageFilters {}

export interface MessageRepository {
  findMany(query?: MessageListQuery): Promise<MessageFeed>;
  /** Distinct tenants that have message traffic, for the Tenant filter. */
  listTenantOptions(): Promise<readonly { id: string; name: string }[]>;
}
