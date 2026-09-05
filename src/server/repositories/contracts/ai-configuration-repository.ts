import type { AiConfigurationView } from "@/features/ai-settings/types";

export interface AiConfigurationRepository {
  /** Never returns the stored credential, only a fingerprint of it (S-01). */
  findActive(): Promise<AiConfigurationView>;
}
