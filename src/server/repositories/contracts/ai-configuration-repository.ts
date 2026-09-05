import type { AiConfigurationSettings } from "@/features/ai-settings/schemas";
import type { AiConfigurationView } from "@/features/ai-settings/types";

export interface AiConfigurationRepository {
  /** Never returns the stored credential, only a fingerprint of it (S-01). */
  findActive(): Promise<AiConfigurationView>;
  /**
   * Writes the non-secret settings. The credential is not part of this call:
   * `secret_reference` holds a secret-manager pointer, not a key, and there is
   * no secret manager wired up yet (S-01 / D-24).
   */
  save(values: AiConfigurationSettings): Promise<void>;
}
