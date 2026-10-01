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

/** Whether the deployment knows its public address (step 1 or 2 above). */
export function siteUrlConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim());
}

/**
 * The address to show the signed-in owner for something a device must
 * reach (the GPS ping address): the configured site URL, else the host the
 * owner's own browser used — never the localhost fallback, which would
 * hand an installer a dead address on a self-hosted deploy without the
 * variable. Not for e-mailed links (a forged Host header must never shape
 * a reset link): those keep siteUrl().
 */
export function shownOrigin(headers: { get(name: string): string | null }): string {
  if (siteUrlConfigured()) return siteUrl();
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return siteUrl();
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const scheme = proto === "http" || proto === "https" ? proto : /^(localhost|127\.)/.test(host) ? "http" : "https";
  return `${scheme}://${host}`;
}
