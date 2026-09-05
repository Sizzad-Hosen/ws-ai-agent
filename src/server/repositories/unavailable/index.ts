import type { ActivityEntry } from "@/features/dashboard/types";
import type { MessageFeed } from "@/features/messages/types";
import type { UsageSummary, UsageTimeframe } from "@/features/usage/types";
import type { WhatsappAccount, WhatsappSummary } from "@/features/whatsapp/types";
import type { ActivityRepository } from "@/server/repositories/contracts/activity-repository";
import type {
  MessageListQuery,
  MessageRepository,
} from "@/server/repositories/contracts/message-repository";
import type { UsageRepository } from "@/server/repositories/contracts/usage-repository";
import type {
  WhatsappListQuery,
  WhatsappRepository,
} from "@/server/repositories/contracts/whatsapp-repository";
import type { PaginatedResult } from "@/types/repository";

/**
 * Null-object adapters for the four ports whose tables do not exist.
 *
 * WhatsApp account health, the message log, AI usage rollups and the platform
 * activity feed have no tables anywhere in
 * `docs/db/SaaS Master DB — BO + Public Site.png` — see §2.2 / §2.3 and
 * decisions D-10 / D-11 in docs/IMPLEMENTATION_PLAN.md.
 *
 * They report *absence*, never zero: a screen must be able to say "there is no
 * source for this" rather than "there is no activity". Replace each with a
 * Prisma adapter once the backing tables are approved.
 */

export class UnavailableWhatsappRepository implements WhatsappRepository {
  async findMany(
    query: WhatsappListQuery = {},
  ): Promise<PaginatedResult<WhatsappAccount>> {
    return {
      items: [],
      total: 0,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async findByTenantId(): Promise<WhatsappAccount | null> {
    return null;
  }

  async summary(): Promise<WhatsappSummary | null> {
    return null;
  }
}

export class UnavailableMessageRepository implements MessageRepository {
  async findMany(query: MessageListQuery = {}): Promise<MessageFeed> {
    return {
      items: [],
      total: 0,
      failedCount: 0,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async listTenantOptions(): Promise<readonly { id: string; name: string }[]> {
    return [];
  }
}

export class UnavailableUsageRepository implements UsageRepository {
  async summary(_timeframe: UsageTimeframe): Promise<UsageSummary | null> {
    return null;
  }

  async currentTokenUsage(): Promise<{ tokens: number; asOf: string } | null> {
    return null;
  }
}

export class UnavailableActivityRepository implements ActivityRepository {
  async recent(): Promise<readonly ActivityEntry[]> {
    return [];
  }
}
