// Browser error reporting: errors in the owner's browser (a crashed
// component, a failed client action) go to Sentry, scrubbed the same way as
// the server's (lib/observability/sentry.ts). Off unless
// NEXT_PUBLIC_SENTRY_DSN is set on a production build.

import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/observability/sentry";

try {
  Sentry.init(sentryOptions());
} catch {
  // Monitoring must never stop the app from starting.
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
