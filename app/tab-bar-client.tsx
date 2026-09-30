"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref } from "@/lib/nav/section";
import { OPEN_ACCOUNT_MENU } from "./nav-events";

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9h13v-9" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  building: (
    <>
      <path d="M5 20V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" />
      <path d="M3 20h18" />
      <path d="M10 20v-4h4v4" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  car: (
    <>
      <path d="M5 16.5V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4.5" />
      <path d="M3.5 16.5h17M5 12h14" />
      <circle cx="8" cy="16.5" r="1.8" />
      <circle cx="16" cy="16.5" r="1.8" />
    </>
  ),
  invest: (
    <>
      <path d="M4 19h16" />
      <path d="M5 15l4.5-4.5 3.5 3L19 7.5" />
      <path d="M14.5 7.5H19V12" />
    </>
  ),
  menu: (
    <>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </>
  ),
};

export default function TabBarClient({
  items,
  navLabel,
}: {
  items: {
    href: string;
    label: string;
    icon: string;
    center?: boolean;
    action?: "menu";
    /** A count (or a dot) on the icon — the bell's alerts. */
    badge?: number | "dot" | null;
  }[];
  /** The bar's name for screen readers, in the owner's language. */
  navLabel: string;
}) {
  const pathname = usePathname();
  // A sub-page lights its parent: /bookings and /analytics → Calendar.
  const current = activeHref(
    pathname,
    items.filter((item) => !item.action).map((item) => item.href),
  );
  const active = (href: string) => href === current;

  return (
    <nav className="tabbar" aria-label={navLabel}>
      {items.map((item) => {
        const icon = (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {ICONS[item.icon]}
          </svg>
        );
        if (item.action === "menu") {
          // Workspaces with no fifth section: the seat opens the account
          // menu (settings, plan, help) instead of an empty page.
          return (
            <button
              key={item.href}
              type="button"
              aria-label={item.label}
              title={item.label}
              aria-haspopup="menu"
              data-account-menu-seat
              className="tabbar__item"
              onClick={() => window.dispatchEvent(new Event(OPEN_ACCOUNT_MENU))}
            >
              {icon}
            </button>
          );
        }
        const on = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={on ? "page" : undefined}
            title={item.label}
            className={
              item.center
                ? `tabbar__item tabbar__item--center${on ? " tabbar__item--on" : ""}`
                : `tabbar__item${on ? " tabbar__item--on" : ""}`
            }
          >
            {item.center ? <span className="tabbar__bubble">{icon}</span> : icon}
            {item.badge != null && (
              <span className={item.badge === "dot" ? "nav-badge nav-badge--dot" : "nav-badge"} aria-hidden>
                {item.badge === "dot" ? "" : item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
