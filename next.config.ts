import type { NextConfig } from "next";

// Security headers.
//
// Everything the app loads is its own: fonts are self-hosted by
// next/font, the tutorial videos live in /public, and every third-party
// call (Anthropic, Meta, Flitt, the price feeds) is made server-side. So
// the policy can be shut down to `'self'` almost everywhere.
//
// The one loose thread is `'unsafe-inline'`: the UI styles elements with
// React `style={{…}}` props throughout, and Next's bootstrap emits an
// inline script. Tightening those to a per-request nonce means routing
// every page through a proxy and giving up static rendering, so it is
// recorded as a planned step rather than done half-way here.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self'",
  "font-src 'self' data:",
  // No browser-side calls leave the origin; the server makes them instead.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces for frame-ancestors, for the browsers that predate it.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the page a person came from — some URLs name an asset.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The app asks for none of these; saying so stops an injected script
    // from asking on its behalf.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to a scanner.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Personal data must never sit in a shared cache.
        source: "/api/account/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
