import type { NextConfig } from "next";

// Security headers on every response.
//
// - Framing: X-Frame-Options DENY (enforced) — no site may put Activo in a
//   frame and trick a signed-in owner into clicking its buttons.
// - Content-Security-Policy-Report-Only: the policy the app is meant to
//   live within (own scripts/styles/fonts, Flitt's payment page as a form
//   target, frame-ancestors 'none'). Report-only for now: violations
//   break nothing; browsers send each one to /api/csp-report (report-uri,
//   and report-to via Reporting-Endpoints), which writes one JSON log line
//   ("event":"csp_violation"). Switch the header name to
//   Content-Security-Policy once the logs have run clean for a while.
// - nosniff, a referrer policy that never sends a full URL (with a reset
//   or tracker token in it) to another site, and a minimal
//   Permissions-Policy (no camera/microphone/payment APIs; geolocation only
//   for this site's own pages).
// - HSTS on production only — a local http://localhost must keep working.
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && Boolean(process.env.VERCEL));

const cspReportOnly = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts; styles use inline attributes.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self'",
  // Sentry's EU ingest (lib/observability/sentry.ts) for browser errors.
  "connect-src 'self' https://*.ingest.de.sentry.io",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://pay.flitt.com https://pay.fondy.eu",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]
    : []),
];

// Home for a signed-in owner lives in its own segment, app/dashboard, so its
// loading.tsx (the dashboard skeleton) is prefetched with the Home link and
// paints the moment Home is tapped — while the signed-out landing at "/"
// keeps having no skeleton in front of its splash. A request for "/" that
// carries a session token (lib/auth/session.ts: cookie "session", 32 random
// bytes in hex) is served from /dashboard; the address bar keeps "/". An
// unrecognised or stale cookie still ends well: app/page.tsx renders the
// dashboard itself, and app/dashboard/page.tsx renders the landing when the
// session is gone. /dashboard typed in directly goes back to "/".
const SIGNED_IN = [{ type: "cookie" as const, key: "session", value: "[0-9a-f]{64}" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [{ source: "/dashboard", destination: "/", permanent: false }];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", has: SIGNED_IN, destination: "/dashboard" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
