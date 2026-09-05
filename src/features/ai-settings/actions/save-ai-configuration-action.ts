"use server";

import { revalidatePath } from "next/cache";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  aiConfigurationFormSchema,
  toAiConfigurationSettings,
} from "@/features/ai-settings/schemas";
import { requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";

export interface AiConfigurationActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Saves the platform AI configuration.
 *
 * Note: this action is not audited. `platform_audit_logs` is not in the ERD
 * (§2.3), so a change to the global token limit leaves no record of who made it.
 */
export async function saveAiConfigurationAction(
  input: unknown,
): Promise<AiConfigurationActionResult> {
  await requirePermission(PLATFORM_PERMISSIONS.AI_SETTINGS_MANAGE);

  const parsed = aiConfigurationFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const values = parsed.data;
  const view = await repositories.aiConfiguration.findActive();

  // A model belongs to exactly one provider; pairing them freely would leave a
  // configuration that cannot serve traffic.
  const model = view.models.find((item) => item.id === values.modelId);

  if (!model || model.providerId !== values.providerId) {
    return {
      success: false,
      message: "That model does not belong to the selected provider.",
      fieldErrors: { modelId: ["Choose a model offered by this provider."] },
    };
  }

  try {
    await repositories.aiConfiguration.save(toAiConfigurationSettings(values));
  } catch (error: unknown) {
    console.error("Unable to save the AI configuration.", error);
    return {
      success: false,
      message: "That change could not be saved. Please try again.",
    };
  }

  revalidatePath(ROUTES.bo.aiSettings);

  return { success: true, message: "AI configuration saved." };
}
