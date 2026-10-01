// Which navigation entry a page belongs to — the "you are here" cue of the
// top nav, the phone's account menu and the tab bar. Pure, client-safe.
//
// A sub-page lights its parent: /units, /bookings, /pricing and /analytics
// are part of Rentals, whose landing page is the calendar (/calendar);
// /assets/<id>/rental is part of Assets (of Fleet, where the bar has a
// Fleet seat); /invest/pro is part of Invest.
// A bar that has its own seat for /units lights that seat instead.

/** Pages that live under another entry than their own path. */
const SECTION_OF: { prefix: string; section: string }[] = [
  { prefix: "/calendar", section: "/calendar" },
  { prefix: "/units", section: "/calendar" },
  { prefix: "/bookings", section: "/calendar" },
  { prefix: "/pricing", section: "/calendar" },
  { prefix: "/analytics", section: "/calendar" },
];

const under = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The top-level section of a path: "/", "/calendar", "/assets", … */
export function sectionOf(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (path === "/") return "/";
  for (const { prefix, section } of SECTION_OF) {
    if (under(path, prefix)) return section;
  }
  return `/${path.split("/")[1]}`;
}

/**
 * Of the given entries, the one to mark as current: the entry the path is
 * on or under (the longest wins, so a tab for /calendar beats /units), else
 * the entry of the path's section. Null when none of them fits.
 */
/**
 * The aria-current value of a navigation entry: "page" when the reader is
 * on that very page, "true" when it is only the section of the page (a
 * sub-page lights its parent) — so a page has one "page", not two.
 */
export function currentValue(pathname: string, href: string, current: string | null): "page" | "true" | undefined {
  if (href !== current) return undefined;
  const path = pathname.split(/[?#]/)[0] || "/";
  return path === href ? "page" : "true";
}

export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  const path = pathname.split(/[?#]/)[0] || "/";
  // A rental desk belongs to the fleet where the workspace has one: a car
  // opened from /fleet keeps "Fleet" lit, not "Assets".
  if (hrefs.includes("/fleet") && /^\/assets\/[^/]+\/rental$/.test(path)) return "/fleet";
  const direct = hrefs
    .filter((href) => under(path, href))
    .sort((a, b) => b.length - a.length)[0];
  if (direct) return direct;
  const section = sectionOf(path);
  return hrefs.includes(section) ? section : null;
}
