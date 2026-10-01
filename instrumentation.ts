// Server error reporting. Next.js calls onRequestError for every error it
// captures on the server — page renders, route handlers, server actions —
// so a failure in production leaves one structured line in the logs (Vercel
// → Logs, or any log drain) instead of vanishing. It lives at the project
// root, next to app/: that is where Next.js looks for instrumentation.
//
// The line holds what is needed to find the fault — route, kind, method,
// the error's name, message and digest, the first stack frames — and never
// request headers, cookies, query strings or bodies (sessions, reset
// tokens, phone numbers).

//
// With NEXT_PUBLIC_SENTRY_DSN set, each error also goes to Sentry (grouped,
// with the full stack), scrubbed the same way — lib/observability/sentry.ts.

import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { scrubUrl, sentryOptions } from "./lib/observability/sentry";

export function register() {
  // Same options on the Node and edge runtimes; a no-op without a DSN.
  Sentry.init(sentryOptions());
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    Sentry.captureRequestError(error, { ...request, path: scrubUrl(request.path), headers: {} }, context);
  } catch {
    // the log line below is the record
  }
  const err = error instanceof Error ? error : null;
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : undefined;
  const entry = {
    level: "error",
    event: "request_error",
    at: new Date().toISOString(),
    method: request.method,
    // The path without its query string, and without a reset link's token.
    path: request.path.split("?")[0].replace(/^\/reset\/[^/]+/, "/reset/[token]"),
    route: context.routePath,
    routeType: context.routeType,
    renderSource: "renderSource" in context ? context.renderSource : undefined,
    name: err?.name ?? typeof error,
    message: (err?.message ?? String(error)).slice(0, 500),
    digest,
    stack: err?.stack?.split("\n").slice(1, 6).map((line) => line.trim()),
  };
  console.error(JSON.stringify(entry));
  await alertWebhook(entry);
};

// Alerting: with ERROR_WEBHOOK_URL set (a Slack / Discord / Teams incoming
// webhook, or any endpoint taking JSON), the same line is posted there too,
// so an error reaches a person instead of waiting in the logs. At most one
// post per route a minute per instance; a webhook that is down never
// breaks the request.
const lastPosted = new Map<string, number>();

async function alertWebhook(entry: { route?: string; path: string; name: string; message: string; digest?: string; at: string }) {
  const url = process.env.ERROR_WEBHOOK_URL?.trim();
  if (!url || !/^https:\/\//.test(url)) return;
  const key = entry.route ?? entry.path;
  const now = Date.now();
  if (now - (lastPosted.get(key) ?? 0) < 60_000) return;
  lastPosted.set(key, now);
  const text = `Activo error on ${entry.route ?? entry.path}: ${entry.name}: ${entry.message}${
    entry.digest ? ` (digest ${entry.digest})` : ""
  } at ${entry.at}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // "text" for Slack, "content" for Discord; the full line for anything else.
      body: JSON.stringify({ text, content: text.slice(0, 1900), entry }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // the log line above is the record
  }
}
