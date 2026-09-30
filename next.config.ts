import type { NextConfig } from "next";

// Security headers on every response.
//
// - Framing: X-Frame-Options DENY (enforced) — no site may put Activo in a
//   frame and trick a signed-in owner into clicking its buttons.
// - Content-Security-Policy-Report-Only: the policy the app is meant to
//   live within (own scripts/styles/fonts, Flitt's payment page as a form
//   target, frame-ancestors 'none'). Report-only for now: violations show
//   in the browser console without breaking anything; switch the header
//   name to Content-Security-Policy once it has run clean for a while.
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
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://pay.flitt.com https://pay.fondy.eu",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
