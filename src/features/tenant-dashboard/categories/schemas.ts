import { z } from "zod";

import { slugSchema } from "@/features/tenant-dashboard/slug";

/** Slugs address a category in a URL, so the shape is constrained, not free. */
export const categorySlugSchema = slugSchema(180);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(150),
  slug: categorySlugSchema,
  description: z.string().trim().max(2000).optional(),
  /** Null is a top-level category; a uuid nests it under another. */
  parentId: z.uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
