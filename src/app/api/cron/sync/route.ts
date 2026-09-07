import { apiData, apiError } from "@/server/api/http";
import { resolveEmbedder } from "@/server/catalog-sync/embed";
import { syncTenantCatalogue } from "@/server/catalog-sync/sync-service";
import { resolveFleet } from "@/server/catalog-sync/tenant-fleet";

/**
 * The sync pass, as a Vercel Cron target.
 *
 * `POST /api/cron/sync` every minute. Serverless, so the pass is bounded
 * rather than continuous: it claims what it can inside its window and leaves
 * the rest for the next invocation, and concurrent invocations are safe because
 * jobs are claimed with `FOR UPDATE SKIP LOCKED` (see sync-service.ts).
 *
 * Secured by a shared secret, not by session auth: cron has no user. Vercel
 * sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations, and
 * without the variable set this route refuses everything — an unauthenticated
 * endpoint that walks every tenant's database is not something to leave open
 * by accident.
 */

/** Serverless functions get cut off; the pass keeps its own budget. */
export const maxDuration = 60;

const MAX_TENANTS_PER_PASS = 25;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return apiError(
      "Catalogue sync is not configured; set CRON_SECRET to enable it.",
      503,
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // Deliberately identical to what a wrong secret gets: this endpoint should
    // not tell a caller whether it exists on this deployment.
    return apiError("Not authorised.", 401);
  }

  const embedder = resolveEmbedder();

  if (!embedder) {
    return apiError(
      "No embedding provider is configured; set COHERE_API_KEY to enable catalogue sync.",
      503,
    );
  }

  const fleet = await resolveFleet();
  const results: Record<string, unknown>[] = [];

  for (const member of fleet.members.slice(0, MAX_TENANTS_PER_PASS)) {
    try {
      const report = await syncTenantCatalogue(member.tenant.db, embedder);

      // Only the tenants that did something are reported, so a fleet of idle
      // shops does not produce a wall of zeroes every minute.
      if (report.claimed > 0) {
        results.push({ tenant: member.slug, ...report });
      }
    } catch (error: unknown) {
      // One tenant's failure is not the fleet's: the loop continues, and the
      // failure is reported with the tenant it belongs to.
      console.error(`Catalogue sync failed for ${member.slug}.`, error);
      results.push({
        tenant: member.slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return apiData({
    tenants: fleet.members.length,
    unavailable: fleet.unavailable,
    results,
  });
}
