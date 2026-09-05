import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiFailure } from "@/server/api/http";
import { repositories } from "@/server/repositories";

/**
 * Read-only for now; the write path is being built separately.
 *
 * The repository never returns the stored credential, only a fingerprint of
 * it (S-01), so the view is safe to serialise as-is.
 */
export async function GET(): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.AI_SETTINGS_READ);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const view = await repositories.aiConfiguration.findActive();
    return apiData(view);
  } catch (error: unknown) {
    return apiFailure("Unable to load the AI configuration.", error);
  }
}
