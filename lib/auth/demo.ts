// The shared public demo account (its sign-in is printed on the landing
// and login pages). Anyone can open it, so it is read-only: every server
// action that writes goes through requireWriter (lib/auth/session.ts),
// which sends a demo visitor back where they were with ?demo=readonly.
// Client-safe and pure.

export const DEMO_EMAIL = "test@activo.world";

/** Query flag the demo ribbon reacts to (app/demo-ribbon.tsx). */
export const DEMO_FLAG = "demo";
export const DEMO_READONLY = "readonly";

/**
 * Where to send a demo visitor whose change was refused: the page they came
 * from (same host only — never an outside URL from a forged Referer), with
 * ?demo=readonly added. Falls back to the dashboard.
 */
export function demoRefusalPath(referer: string | null | undefined, host: string | null | undefined): string {
  let path = "/";
  let params = new URLSearchParams();
  if (referer) {
    try {
      const url = new URL(referer);
      if (host && url.host === host && url.pathname.startsWith("/") && !url.pathname.startsWith("//")) {
        path = url.pathname;
        params = new URLSearchParams(url.search);
      }
    } catch {
      /* not a URL — use the dashboard */
    }
  }
  params.set(DEMO_FLAG, DEMO_READONLY);
  return `${path}?${params.toString()}`;
}
