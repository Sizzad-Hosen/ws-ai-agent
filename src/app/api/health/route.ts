import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import type { HealthResponse } from "@/features/system/schemas";

export function GET(): Response {
  const response: HealthResponse = {
    data: {
      service: APP_CONFIG.shortName,
      status: "ok",
      environment: env.NODE_ENV,
    },
  };

  return Response.json(response);
}
