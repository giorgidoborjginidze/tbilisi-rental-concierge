"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";
import { activeHref } from "@/lib/nav/section";
import { IconChevronDown } from "./icons";

// Unified account menu: avatar + Latin "username · plan". The dropdown
// carries the app navigation (shown on mobile, where the inline nav is
// hidden) plus account actions — Settings, Plan & Billing, Log Out.
export default function AccountMenu({
  name,
  plan,
  initial,
  links,
  labels,
}: {
  name: string;
  plan: string;
  initial: string;
  links: { href: string; label: string }[];
  labels: { settings: string; billing: string; logout: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Open for the page it was opened on: following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenOn(null);
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
  const current = activeHref(pathname, links.map((link) => link.href));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="account-btn"
        data-tour="account"
        onClick={() => setOpenOn(open ? null : pathname)}
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
          {/* Navigation — visible on mobile (inline nav is hidden there). */}
          <div className="account-menu__nav">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="account-menu__item"
                aria-current={link.href === current ? "page" : undefined}
                onClick={close}
              >
                {link.label}
              </Link>
            ))}
            <div className="account-menu__divider" />
          </div>

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
