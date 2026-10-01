// Work a page should not wait for: run after the response is sent (Next's
// after()), or — outside a request, in a script or the daily run — at once
// without being awaited.

import { after } from "next/server";

export function inBackground(task: () => Promise<unknown>): void {
  const run = () => task().catch(() => null);
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * The same refresh at most once per `gapMs` on this server instance: two
 * readers of one stale price on a page (or a burst of page views) ask its
 * source once, and a source that keeps failing is not asked after every
 * response.
 */
const lastStarted = new Map<string, number>();
export function inBackgroundOnce(key: string, task: () => Promise<unknown>, gapMs = 60_000): void {
  const now = Date.now();
  if (now - (lastStarted.get(key) ?? 0) < gapMs) return;
  lastStarted.set(key, now);
  inBackground(task);
}
