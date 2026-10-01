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
