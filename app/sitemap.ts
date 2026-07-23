import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public, indexable pages only. The app's authenticated routes are behind
// login and intentionally left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: { path: string; priority: number; changeFrequency: "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
    { path: "/login", priority: 0.5, changeFrequency: "yearly" },
    { path: "/register", priority: 0.6, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path === "/" ? "" : p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
