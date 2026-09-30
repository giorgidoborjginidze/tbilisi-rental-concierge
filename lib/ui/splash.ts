// The landing splash: at most once per browser session, and only for a
// signed-out visitor on the landing page. The splash sets a session cookie
// (no expiry: it ends with the browser session) the first time it shows;
// the server leaves the splash out whenever the cookie is there — so a
// second visit, a tap on the logo or a return from /login never sees it.
// Client-safe.

export const SPLASH_COOKIE = "splash_seen";
export const SPLASH_DONE_EVENT = "activo:splash-done";

/** Server side: should this request get the splash? */
export const showSplash = (signedIn: boolean, seenCookie: string | undefined): boolean =>
  !signedIn && !seenCookie;

/**
 * Client side: run `start` once the splash is gone — at once when the page
 * has none. Returns a cleanup. Animations that would otherwise play unseen
 * behind the splash (the hero logo, the counters) wait for it.
 */
export function afterSplash(start: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const splash = document.querySelector(".splash:not(.splash--leaving)");
  if (!splash) {
    start();
    return () => {};
  }
  const go = () => start();
  window.addEventListener(SPLASH_DONE_EVENT, go, { once: true });
  return () => window.removeEventListener(SPLASH_DONE_EVENT, go);
}
