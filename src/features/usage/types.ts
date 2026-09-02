export interface TenantUsageSummary {
  readonly id: string;
  readonly tenantId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly messagesProcessed: number;
  readonly aiTokensConsumed: number;
}
