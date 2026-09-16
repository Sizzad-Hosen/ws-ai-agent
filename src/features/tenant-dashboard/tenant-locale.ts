import "server-only";

import { prisma } from "@/server/db/prisma";

/**
 * The tenant's chosen language.
 *
 * Read from the master `tenants` row rather than threaded through
 * `ResolvedTenant`, which does not carry it — the connection is opened for
 * catalogue and conversation data, and a display preference is not that.
 *
 * Nullable on every row today, so `resolveLocale` decides the fallback rather
 * than this function.
 */
export async function readTenantLocale(
  tenantId: string,
): Promise<string | null> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { defaultLocale: true },
  });

  return row?.defaultLocale ?? null;
}
