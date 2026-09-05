import { z } from "zod";

/**
 * Write-side validation for screen 09.
 *
 * The API credential is deliberately not part of this schema. `secret_reference`
 * stores a pointer into a secret manager rather than the key itself, and no
 * secret manager is configured, so there is nowhere to put a new key (S-01).
 */

const optionalCount = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{1,15}$/.test(value), {
    message: "Enter a whole number of tokens, or leave blank for no limit.",
  });

export const aiConfigurationFormSchema = z.object({
  providerId: z.uuid("Choose a provider."),
  modelId: z.uuid("Choose a model."),
  isActive: z.boolean(),
  globalTokenLimit: optionalCount,
  tenantAllocationEnabled: z.boolean(),
  defaultTenantTokenLimit: optionalCount,
  warningThresholdPercent: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 100),
      { message: "Enter a percentage between 1 and 100, or leave blank." },
    ),
});

export type AiConfigurationFormValues = z.infer<
  typeof aiConfigurationFormSchema
>;

/** The shape written to `platform_ai_configurations`. */
export interface AiConfigurationSettings {
  readonly providerId: string;
  readonly modelId: string;
  readonly isActive: boolean;
  readonly globalTokenLimit: bigint | null;
  readonly defaultTenantTokenLimit: bigint | null;
  readonly warningThresholdPercent: number | null;
}

function toCount(value: string): bigint | null {
  return value === "" ? null : BigInt(value);
}

export function toAiConfigurationSettings(
  values: AiConfigurationFormValues,
): AiConfigurationSettings {
  return {
    providerId: values.providerId,
    modelId: values.modelId,
    isActive: values.isActive,
    globalTokenLimit: toCount(values.globalTokenLimit),
    // Turning tenant allocation off clears the per-tenant default, so a stale
    // limit cannot linger and silently apply if it is switched back on.
    defaultTenantTokenLimit: values.tenantAllocationEnabled
      ? toCount(values.defaultTenantTokenLimit)
      : null,
    warningThresholdPercent:
      values.warningThresholdPercent === ""
        ? null
        : Number(values.warningThresholdPercent),
  };
}
