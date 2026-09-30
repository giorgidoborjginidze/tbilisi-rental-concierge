// Where the floating support button stays out of the way: pages whose job
// is a form (adding or editing something, settings, signing in). There the
// button would sit over fields and the Save button on a phone; support is
// still one tap away in the account menu's Help group. Pure, client-safe.

const FORM_PAGES = ["/assets/new", "/units/new", "/bookings/new", "/register", "/login", "/forgot", "/reset", "/onboarding"];

export function supportLauncherHidden(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (FORM_PAGES.some((page) => path === page || path.startsWith(`${page}/`))) return true;
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  // /assets/<id>/edit, /units/<id>/edit, /bookings/<id>/edit …
  return /\/edit$/.test(path);
}

/** The questions the support bot answers by itself (strings bot_q_<id> / bot_a_<id>). */
export const BOT_FAQ_IDS = ["what", "pricing", "sync", "payment", "security", "calc"] as const;
export type BotFaqId = (typeof BOT_FAQ_IDS)[number];
