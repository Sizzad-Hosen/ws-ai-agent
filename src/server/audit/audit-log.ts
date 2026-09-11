import "server-only";

import type { Prisma } from "@prisma/client";

import { clientAddress } from "@/server/auth/login-throttle";
import type { BoSessionAdmin } from "@/server/auth/types";
import { prisma } from "@/server/db/prisma";

/**
 * The console's audit trail.
 *
 * Every privileged mutation records who did it, to what, and what changed.
 * Writes are append-only and best-effort: a failure to record is logged loudly
 * but does not roll back the change the administrator just made, because
 * refusing a legitimate suspension because the audit table is unreachable is
 * the worse of the two failures. The alternative — writing inside each domain
 * transaction — is the stronger guarantee and is worth doing once the audit
 * table shares a connection with the rest of the write path.
 */

export const AUDIT_ACTIONS = {
  TENANT_APPROVE: "tenant.approve",
  TENANT_REJECT: "tenant.reject",
  TENANT_SUSPEND: "tenant.suspend",
  TENANT_REACTIVATE: "tenant.reactivate",
  REGISTRATION_APPROVE: "registration.approve",
  REGISTRATION_REJECT: "registration.reject",
  REGISTRATION_CHECK: "registration.check",
  PLAN_CREATE: "plan.create",
  PLAN_UPDATE: "plan.update",
  PLAN_DELETE: "plan.delete",
  AI_CONFIGURATION_UPDATE: "ai_configuration.update",
  SITE_SETTINGS_UPDATE: "site_settings.update",
  TENANT_IMPERSONATE: "tenant.impersonate",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEntry {
  readonly actor: BoSessionAdmin;
  readonly action: AuditAction;
  readonly entityType: "tenant" | "registration" | "plan" | "settings";
  /** Null for settings that are not a row, such as the AI configuration. */
  readonly entityId?: string | null;
  /** Set when the action names a tenant, for the retention index. */
  readonly tenantId?: string | null;
  /**
   * Required for impersonation and rejected when blank, which the calling
   * action enforces. `admin_audit_logs.reason` is nullable because most
   * actions legitimately have none.
   */
  readonly reason?: string | null;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Keys whose values must never reach the audit table.
 *
 * The trail is read by more people than the write path is, so a credential
 * leaked into it is leaked widely and permanently.
 */
const FORBIDDEN_KEYS = [
  "password",
  "secret",
  "secretreference",
  "token",
  "credential",
  "apikey",
];

export function scrubAuditMetadata(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");

    if (FORBIDDEN_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      safe[key] = "[redacted]";
      continue;
    }

    safe[key] = value;
  }

  return safe as Prisma.InputJsonValue;
}

/**
 * Resolved separately so a header failure costs the address, not the entry.
 * `headers()` throws outside a request scope, and losing the whole record of a
 * privileged action over a missing IP would be the wrong trade.
 */
async function addressOrNull(): Promise<string | null> {
  try {
    return await clientAddress();
  } catch {
    return null;
  }
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const ipAddress = await addressOrNull();

  try {
    await prisma.adminAuditLog.create({
      data: {
        // The actor is the FK, not a copied email: `admin_users` is
        // ON DELETE RESTRICT, so the join can never dangle.
        adminUserId: entry.actor.id,
        tenantId: entry.tenantId ?? null,
        action: entry.action,
        reason: entry.reason ?? null,
        resourceType: entry.entityType,
        resourceId: entry.entityId ?? null,
        newValues: scrubAuditMetadata(entry.metadata),
        ipAddress,
      },
    });
  } catch (error: unknown) {
    // Loud, because an unaudited privileged mutation is a compliance gap and
    // must be visible in the logs even when the table cannot be written.
    console.error(
      `AUDIT WRITE FAILED — ${entry.action} on ${entry.entityType}:${entry.entityId ?? "-"} by ${entry.actor.email}`,
      error,
    );
  }
}
