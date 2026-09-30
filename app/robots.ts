import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public marketing/auth pages are crawlable — the free calculator (/invest)
// included, it is the landing page's second call to action; the
// authenticated app (which just redirects crawlers to /login anyway), the
// sign-in-only PRO analysis and API routes are excluded.
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
        "/fleet",
        "/invest/pro",
        "/onboarding",
        "/settings",
        "/pricing",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
