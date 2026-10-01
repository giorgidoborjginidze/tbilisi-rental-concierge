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

/**
 * Pages that are a working surface edge to edge on a phone — the PRO
 * calculator's fields, a car's payment form, the calendar strip, the
 * price table: there the floating button would cover a field or a day, so
 * on a phone it is left out (Help → Support chat in the account menu
 * still opens it). On wider screens it stays.
 */
const PHONE_WORK_PAGES = [/^\/invest(\/|$)/, /^\/assets\/[^/]+\/rental$/, /^\/calendar$/, /^\/pricing$/, /^\/fleet$/];

export function supportLauncherPhoneHidden(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return PHONE_WORK_PAGES.some((page) => page.test(path));
}

/** The questions the support bot answers by itself (strings bot_q_<id> / bot_a_<id>). */
export const BOT_FAQ_IDS = ["what", "pricing", "sync", "payment", "security", "calc"] as const;
export type BotFaqId = (typeof BOT_FAQ_IDS)[number];
