import type { MessageDirection, MessageStatus } from "@/types/status";

/**
 * Screen 12 (Message Monitoring).
 *
 * No table exists for this in the ERD, and at the volumes on screen 11
 * (450k/day) it should not live in the master OLTP database at all — see 2.2
 * and D-11 in docs/IMPLEMENTATION_PLAN.md.
 */
export interface MessageEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly direction: MessageDirection;
  /**
   * Customer identifier, masked by default. The unmasked value requires a
   * separate permission and writes an audit entry (S-07).
   */
  readonly customerIdentifier: string;
  readonly customerIdentifierMasked: boolean;
  readonly status: MessageStatus;
  readonly latencyMs: number | null;
  readonly occurredAt: string;
}

export interface MessageFilters {
  readonly direction?: MessageDirection;
  readonly status?: MessageStatus;
  readonly tenantId?: string;
  /** The Failed Messages tab on screen 12. */
  readonly failedOnly?: boolean;
}

export interface MessageFeed {
  readonly items: readonly MessageEvent[];
  readonly total: number;
  readonly failedCount: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Masks an email or phone number for the default table view.
 *
 * Non-PII identifiers (API clients, webhook listeners) pass through unchanged —
 * they carry no personal data and masking them only hurts triage.
 */
export function maskCustomerIdentifier(identifier: string): {
  readonly value: string;
  readonly masked: boolean;
} {
  const atIndex = identifier.indexOf("@");

  if (atIndex > 0) {
    const local = identifier.slice(0, atIndex);
    const domain = identifier.slice(atIndex);
    const visible = local.slice(0, Math.min(3, local.length));
    return { value: `${visible}${"*".repeat(3)}${domain}`, masked: true };
  }

  if (/^\+?\d[\d\s-]{5,}$/.test(identifier)) {
    const digits = identifier.replace(/\s|-/g, "");
    const prefix = digits.slice(0, digits.length - 5);
    return { value: `${prefix}${"*".repeat(5)}`, masked: true };
  }

  return { value: identifier, masked: false };
}
