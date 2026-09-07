import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, apiFailure } from "@/server/api/http";
import { catalogueIndexHealth } from "@/server/catalog-sync/retrieval";
import { repositories } from "@/server/repositories";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/**
 * How converged one tenant's catalogue index is.
 *
 * `GET /api/tenants/{id}/sync-status`. Lives under the existing back-office
 * tenant routes rather than a new `/api/admin/...` tree, because that is where
 * the rest of this application's tenant administration already is, and behind
 * the same permission: this reports on a tenant's internals and no tenant may
 * read it about another.
 *
 * The counts come from the tenant's own database, so a tenant whose database is
 * unreachable is reported as such rather than as zero — "nothing indexed" and
 * "cannot tell" are different answers and an operator needs to know which.
 */

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.TENANTS_READ);

  if (!auth.ok) return auth.response;

  const params = paramsSchema.safeParse(await context.params);

  if (!params.success) {
    return apiError("That is not a valid tenant identifier.", 400);
  }

  const tenant = await repositories.tenants.findById(params.data.id);

  if (!tenant) return apiError("No such tenant.", 404);
  if (!tenant.subdomain) {
    return apiError("This tenant has no workspace address yet.", 409);
  }

  try {
    const resolution = await resolveTenant(tenant.subdomain);

    if (!resolution.ok) {
      return apiData({
        tenantId: tenant.id,
        reachable: false,
        reason: resolution.reason,
        indexed: null,
        pending: null,
        failed: null,
        lastSyncedAt: null,
      });
    }

    const health = await catalogueIndexHealth(resolution.tenant.db);

    return apiData({ tenantId: tenant.id, reachable: true, ...health });
  } catch (error: unknown) {
    return apiFailure(
      `Could not read the catalogue index status for tenant ${tenant.id}.`,
      error,
    );
  }
}
