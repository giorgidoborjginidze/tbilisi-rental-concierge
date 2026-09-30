"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";
import { activeHref } from "@/lib/nav/section";
import { IconChevronDown } from "./icons";
import { startTour } from "./tour";
import { OPEN_ACCOUNT_MENU, OPEN_SUPPORT } from "./nav-events";


type MenuLink = { href: string; label: string };

// Unified account menu: avatar + Latin "username · plan". The dropdown
// holds only what the bars lack: on a phone the pages the tab bar has no
// seat for; everywhere a section the top nav has no room for; then one
// Help group (lessons, the tour, the support chat, about, contact) and the
// account itself — Settings, Plan & billing, Log out.
export default function AccountMenu({
  name,
  plan,
  initial,
  mobileLinks,
  moreLinks,
  helpLinks,
  labels,
}: {
  name: string;
  plan: string;
  initial: string;
  /** Shown on phones only (the desktop top nav already has them). */
  mobileLinks: MenuLink[];
  /** Shown at every width. */
  moreLinks: MenuLink[];
  /** Learn, About, Contact — inside the Help group. */
  helpLinks: MenuLink[];
  labels: {
    settings: string;
    billing: string;
    logout: string;
    help: string;
    tour: string;
    support: string;
  };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  // Open for the page it was opened on: following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  // The Help group follows the page each time the menu opens (open on
  // /learn, /about, /contact); a tap then opens or closes it either way.
  const [helpToggled, setHelpToggled] = useState<boolean | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    // The tab bar's menu seat opens this same menu.
    const openFromBar = () => {
      setHelpToggled(null);
      setOpenOn((was) => (was === window.location.pathname ? null : window.location.pathname));
    };
    window.addEventListener(OPEN_ACCOUNT_MENU, openFromBar);
    return () => window.removeEventListener(OPEN_ACCOUNT_MENU, openFromBar);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // A tap on the bar's menu seat toggles through its own event.
      if (target.closest?.("[data-account-menu-seat]")) return;
      if (ref.current && !ref.current.contains(target)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpenOn(null);
  const all = [...mobileLinks, ...moreLinks, ...helpLinks];
  const current = activeHref(pathname, all.map((link) => link.href));
  const item = (link: MenuLink) => (
    <Link
      key={link.href}
      href={link.href}
      className="account-menu__item"
      aria-current={link.href === current ? "page" : undefined}
      onClick={close}
    >
      {link.label}
    </Link>
  );
  const helpCurrent = helpLinks.some((link) => link.href === current);
  const helpOpen = helpToggled ?? helpCurrent;
  const phoneOnly = mobileLinks.filter(
    (link) => !moreLinks.some((more) => more.href === link.href),
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="account-btn"
        data-tour="account"
        onClick={() => {
          setHelpToggled(null);
          setOpenOn(open ? null : pathname);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="account-avatar">{initial}</span>
        <span className="account-label hidden sm:inline">
          {name} · {plan}
        </span>
        <span className="account-btn__caret"><IconChevronDown size={14} /></span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          {/* Pages the phone's tab bar has no seat for (hidden on desktop,
              where the top nav shows them). */}
          {phoneOnly.length > 0 && (
            <div className="account-menu__nav">
              {phoneOnly.map(item)}
              <div className="account-menu__divider" />
            </div>
          )}
          {moreLinks.length > 0 && (
            <>
              {moreLinks.map(item)}
              <div className="account-menu__divider" />
            </>
          )}

          {/* Help: one group instead of five top-level links. */}
          <button
            type="button"
            className="account-menu__item account-menu__group"
            aria-expanded={helpOpen}
            onClick={() => setHelpToggled(!helpOpen)}
          >
            {labels.help}
            <span
              className="account-menu__chevron"
              data-open={helpOpen ? "true" : undefined}
            >
              <IconChevronDown size={14} />
            </span>
          </button>
          {helpOpen && (
            <div className="account-menu__sub">
              {helpLinks.slice(0, 1).map(item)}
              <button
                type="button"
                className="account-menu__item"
                onClick={() => {
                  close();
                  startTour();
                  router.push("/");
                }}
              >
                {labels.tour}
              </button>
              <button
                type="button"
                className="account-menu__item"
                onClick={() => {
                  close();
                  window.dispatchEvent(new Event(OPEN_SUPPORT));
                }}
              >
                {labels.support}
              </button>
              {helpLinks.slice(1).map(item)}
            </div>
          )}
          <div className="account-menu__divider" />

          <Link
            href="/settings"
            className="account-menu__item"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            onClick={close}
          >
            {labels.settings}
          </Link>
          <Link
            href="/billing"
            className="account-menu__item"
            aria-current={pathname.startsWith("/billing") ? "page" : undefined}
            onClick={close}
          >
            {labels.billing}
          </Link>
          <form action={logout}>
            <button type="submit" className="account-menu__item account-menu__item--danger">
              {labels.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
