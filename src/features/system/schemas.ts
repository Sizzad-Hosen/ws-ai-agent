import { z } from "zod";

export const healthResponseSchema = z.object({
  data: z.object({
    service: z.string(),
    status: z.literal("ok"),
    environment: z.enum(["development", "test", "production"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
