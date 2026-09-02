export interface PlatformAuditLog {
  readonly id: string;
  readonly actorAdminId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}
