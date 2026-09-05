import type { MetadataRoute } from "next";

import { env } from "@/config/env";

/**
 * The marketing site is indexable; the console is not.
 *
 * The layouts already send `noindex` for those routes, so this is the second of
 * two independent controls rather than the only one — a crawler that ignores
 * robots.txt still meets the meta tag.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/bo", "/bo/", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
