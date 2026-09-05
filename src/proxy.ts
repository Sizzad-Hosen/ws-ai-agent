import { NextResponse, type NextRequest } from "next/server";

import {
  TENANT_HOST_HEADER,
  TENANT_LABEL_HEADER,
} from "@/server/tenancy/headers";
import { tenantLabelFromHost } from "@/server/tenancy/host";

/**
 * Host analysis for tenant routing.
 *
 * The `middleware` convention is deprecated in Next 16 in favour of `proxy`
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * This runs before rendering and may be deployed to a CDN, so it holds no
 * shared state and reaches nothing: it decides only whether a request *looks*
 * tenant-scoped and forwards the label as a header. Which tenant that label
 * names, and whether it may be served, is resolved in the Node runtime by
 * `resolveTenant`, which can reach the database.
 *
 * Both tenant headers are deleted from the incoming request before either is
 * set. Without that, a client could send `x-tenant-label: victim` to a
 * platform host and be served another tenant's data.
 */
export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_LABEL_HEADER);
  headers.delete(TENANT_HOST_HEADER);

  const host = request.headers.get("host") ?? "";
  headers.set(TENANT_HOST_HEADER, host);

  const label = tenantLabelFromHost(
    host,
    // `@/config/env` is server-only and cannot load here, so this is read raw.
    process.env.TENANT_ROOT_DOMAIN ?? "",
  );

  if (label) {
    headers.set(TENANT_LABEL_HEADER, label);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Static assets and image optimisation never need tenant resolution.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
