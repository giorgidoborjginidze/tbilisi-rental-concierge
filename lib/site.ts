// Canonical public URL of the deployment. Resolved once, server-side, so
// metadata / robots / sitemap all point at the same origin.
//
// Priority:
//   1. NEXT_PUBLIC_SITE_URL — set this in Vercel once a custom domain is
//      connected (e.g. "https://activo.world"). Highest priority.
//   2. VERCEL_PROJECT_PRODUCTION_URL — injected by Vercel automatically and
//      updates to the custom domain once it's the Primary Domain, so canonical
//      links follow the domain even before step 1 is set.
//   3. localhost fallback for local development.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
