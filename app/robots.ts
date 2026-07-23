import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public marketing/auth pages are crawlable; the authenticated app (which
// just redirects crawlers to /login anyway) and API routes are excluded.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/assets",
        "/units",
        "/bookings",
        "/billing",
        "/analytics",
        "/alerts",
        "/calendar",
        "/invest",
        "/onboarding",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
