import type { MetadataRoute } from "next";

import { env } from "@/config/env";
import { ROUTES } from "@/constants/routes";

/** Public routes only; nothing under /bo belongs in a sitemap. */
const PUBLIC_ROUTES: readonly { path: string; priority: number }[] = [
  { path: ROUTES.public.home, priority: 1 },
  { path: ROUTES.public.pricing, priority: 0.9 },
  { path: ROUTES.public.product, priority: 0.8 },
  { path: ROUTES.public.solutions, priority: 0.8 },
  { path: ROUTES.public.demo, priority: 0.7 },
  { path: ROUTES.public.company, priority: 0.6 },
  { path: ROUTES.public.register, priority: 0.9 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route.path, env.NEXT_PUBLIC_APP_URL).toString(),
    lastModified,
    changeFrequency: "weekly",
    priority: route.priority,
  }));
}
