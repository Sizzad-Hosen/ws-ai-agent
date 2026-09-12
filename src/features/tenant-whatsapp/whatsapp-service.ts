import "server-only";

import { prisma } from "@/server/db/prisma";

import type { ConnectionState } from "./connection";

/**
 * A tenant's WhatsApp connection, read from the **master** database.
 *
 * Every WhatsApp table lives in the master on purpose: the webhook has to
 * resolve `phone_number_id` to a tenant before any tenant database can be
 * opened, so the registry cannot live inside the thing it selects.
 *
 * This is the one place in the tenant workspace that queries the master, and
 * it filters by `tenant_id` explicitly — there is no connection boundary doing
 * it here, so the filter is load-bearing rather than belt-and-braces.
 */

export interface WhatsappConnection {
  readonly id: string;
  readonly state: ConnectionState;
  readonly phoneNumberId: string;
  readonly displayPhoneNumber: string | null;
  readonly verifiedName: string | null;
  readonly wabaId: string;
  readonly qualityRating: string | null;
  readonly messagingLimit: string | null;
  readonly subscribedAt: string | null;
  readonly lastWebhookAt: string | null;
  readonly tokenExpiresAt: string | null;
  readonly lastError: string | null;
  /** Events received for this number in the last 24 hours. */
  readonly eventsLastDay: number;
}

export interface WhatsappOnboardingAttempt {
  readonly id: string;
  readonly status: string;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
}

export interface TenantWhatsappView {
  readonly connection: WhatsappConnection | null;
  /** The most recent attempt, which is what a failure screen explains. */
  readonly lastAttempt: WhatsappOnboardingAttempt | null;
  /** False when the platform has no Meta app configured yet. */
  readonly platformConfigured: boolean;
}

export async function loadTenantWhatsapp(
  tenantId: string,
  platformConfigured: boolean,
): Promise<TenantWhatsappView> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [account, attempt] = await Promise.all([
    prisma.whatsappAccount.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        phoneNumberId: true,
        displayPhoneNumber: true,
        verifiedName: true,
        wabaId: true,
        qualityRating: true,
        messagingLimit: true,
        subscribedAt: true,
        lastWebhookAt: true,
        tokenExpiresAt: true,
        lastError: true,
      },
    }),
    prisma.whatsappOnboardingSession.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
  ]);

  const eventsLastDay = account
    ? await prisma.webhookEvent.count({
        where: {
          tenantId,
          phoneNumberId: account.phoneNumberId,
          receivedAt: { gte: dayAgo },
        },
      })
    : 0;

  return {
    platformConfigured,
    connection: account
      ? {
          id: account.id,
          state: account.status,
          phoneNumberId: account.phoneNumberId,
          displayPhoneNumber: account.displayPhoneNumber,
          verifiedName: account.verifiedName,
          wabaId: account.wabaId,
          qualityRating: account.qualityRating,
          messagingLimit: account.messagingLimit,
          subscribedAt: account.subscribedAt?.toISOString() ?? null,
          lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null,
          tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
          lastError: account.lastError,
          eventsLastDay,
        }
      : null,
    lastAttempt: attempt
      ? {
          id: attempt.id,
          status: attempt.status,
          errorCode: attempt.errorCode,
          errorMessage: attempt.errorMessage,
          startedAt: attempt.createdAt.toISOString(),
        }
      : null,
  };
}
