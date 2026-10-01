// Shared Sentry settings for the server, edge and browser runtimes.
//
// Sentry is on only when NEXT_PUBLIC_SENTRY_DSN is set (Vercel → project
// env) and the code runs as a production build, so local dev and tests
// never send anything. Errors only — no performance traces and no session
// replay, which keeps the free plan's quota for real faults and keeps
// owners' screens off a third-party service.
//
// Privacy, matching instrumentation.ts's log line: no IP addresses, cookies
// or headers (sendDefaultPii off, headers dropped below), no query strings,
// and a reset link's token is masked in every URL Sentry would keep.

import type { ErrorEvent } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

export function sentryEnabled(): boolean {
  return Boolean(SENTRY_DSN) && process.env.NODE_ENV === "production";
}

/** The deployment environment Sentry groups issues by. */
export function sentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "production"
  );
}

/** Paths whose last part is a key: whoever has it can open the page. */
const KEYED_PATHS = /\/(reset|verify|i|api\/ical)\/[^/]+/;

/** A path or URL without its query string, fragment or secret token. */
export function scrubUrl(value: string): string {
  return value.split(/[?#]/)[0].replace(KEYED_PATHS, (_m, kind: string) => `/${kind}/[token]`);
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  for (const crumb of event.breadcrumbs ?? []) {
    const data = crumb.data as Record<string, unknown> | undefined;
    if (data && typeof data.url === "string") data.url = scrubUrl(data.url);
    if (data && typeof data.to === "string") data.to = scrubUrl(data.to);
    if (data && typeof data.from === "string") data.from = scrubUrl(data.from);
  }
  return event;
}

export function sentryOptions() {
  return {
    dsn: SENTRY_DSN,
    enabled: sentryEnabled(),
    environment: sentryEnvironment(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  };
}
