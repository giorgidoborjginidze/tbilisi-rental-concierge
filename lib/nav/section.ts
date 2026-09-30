// Which navigation entry a page belongs to — the "you are here" cue of the
// top nav, the phone's account menu and the tab bar. Pure, client-safe.
//
// A sub-page lights its parent: /calendar, /bookings, /pricing and
// /analytics are part of Rentals (/units); /assets/<id>/rental is part of
// Assets; /invest/pro is part of Invest.

/** Pages that live under another entry than their own path. */
const SECTION_OF: { prefix: string; section: string }[] = [
  { prefix: "/units", section: "/units" },
  { prefix: "/calendar", section: "/units" },
  { prefix: "/bookings", section: "/units" },
  { prefix: "/pricing", section: "/units" },
  { prefix: "/analytics", section: "/units" },
];

const under = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The top-level section of a path: "/", "/units", "/assets", … */
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
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  const path = pathname.split(/[?#]/)[0] || "/";
  const direct = hrefs
    .filter((href) => under(path, href))
    .sort((a, b) => b.length - a.length)[0];
  if (direct) return direct;
  const section = sectionOf(path);
  return hrefs.includes(section) ? section : null;
}
