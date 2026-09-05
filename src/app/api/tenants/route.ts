import type { NextRequest } from "next/server";
import { z } from "zod";

import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { authorizeApiRequest } from "@/server/api/authorization";
import { apiData, apiError, apiFailure } from "@/server/api/http";
import { repositories } from "@/server/repositories";
import {
  TENANT_APPROVAL_STATUSES,
  WHATSAPP_CONNECTION_STATUSES,
} from "@/types/status";

/**
 * Unknown enum values are dropped rather than rejected: the tenants page does
 * the same, so a stale bookmark still returns a list instead of an error.
 */
const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(TENANT_APPROVAL_STATUSES).optional().catch(undefined),
  plan: z.string().trim().max(100).optional(),
  whatsapp: z.enum(WHATSAPP_CONNECTION_STATUSES).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Blank values are absent values, so `?status=` does not fail validation. */
function toQueryRecord(params: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {};

  for (const [key, value] of params) {
    if (value.trim() !== "") {
      record[key] = value;
    }
  }

  return record;
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authorizeApiRequest(PLATFORM_PERMISSIONS.TENANTS_READ);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = querySchema.safeParse(
    toQueryRecord(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return apiError("Those query parameters were not understood.", 400);
  }

  const { search, status, plan, whatsapp, limit, offset } = parsed.data;

  try {
    const result = await repositories.tenants.findMany({
      search,
      status,
      planCode: plan,
      whatsapp,
      limit,
      offset,
    });

    return apiData(result);
  } catch (error: unknown) {
    return apiFailure("Unable to list tenants.", error);
  }
}
