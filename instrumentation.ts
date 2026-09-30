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

import type { Instrumentation } from "next";

export function register() {
  // Nothing to set up: errors are reported through onRequestError below.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
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
};
