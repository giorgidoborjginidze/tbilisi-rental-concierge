import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public pages that answer a signed-out visitor with content (not a
// redirect to /login): the landing, the free calculator, learning and
// company pages, and the sign-up. The app's authenticated routes are
// behind login and left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: { path: string; priority: number; changeFrequency: "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "monthly" },
    { path: "/invest", priority: 0.8, changeFrequency: "monthly" },
    { path: "/learn", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/register", priority: 0.6, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path === "/" ? "" : p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
