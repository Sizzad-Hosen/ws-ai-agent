import type { AiProviderStatus } from "@/types/status";

/** `ai_providers`. */
export interface AiProvider {
  readonly id: string;
  readonly name: string;
  readonly status: AiProviderStatus;
}

/** `ai_models`. */
export interface AiModel {
  readonly id: string;
  readonly providerId: string;
  readonly modelName: string;
  readonly capabilities: readonly string[];
  readonly isActive: boolean;
}

/**
 * `platform_ai_configurations`.
 *
 * The stored `secret_reference` is deliberately absent from this type. The
 * credential is write-only: it is never returned by any read path, in any
 * form (S-01). Only a non-reversible fingerprint reaches the client.
 */
export interface PlatformAiConfiguration {
  readonly id: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly isActive: boolean;
  readonly globalTokenLimit: number | null;
  readonly defaultTenantTokenLimit: number | null;
  readonly warningThresholdPercent: number | null;
  /** Last four characters only, for "is this the key I expect?" recognition. */
  readonly credentialFingerprint: string | null;
  readonly credentialRotatedAt: string | null;
  /**
   * Null always: `platform_ai_configurations` has no `updated_at` column in
   * master-db.sql. Kept on the view so the screen can say "unknown" rather
   * than invent a time the row was never stamped with.
   */
  readonly updatedAt: string | null;
}

/** Screen 09 aggregate. */
export interface AiConfigurationView {
  readonly configuration: PlatformAiConfiguration;
  readonly providers: readonly AiProvider[];
  readonly models: readonly AiModel[];
  readonly tenantAllocationEnabled: boolean;
  /** Live consumption against `globalTokenLimit`; null when rollups are absent. */
  readonly currentTokenUsage: number | null;
  readonly usageAsOf: string | null;
}
