import { z } from "zod";

export const identifierSchema = z.string().trim().min(1).max(128);

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().max(100).optional(),
});
