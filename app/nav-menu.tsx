"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { activeHref, currentValue } from "@/lib/nav/section";
import { IconClose, IconMenu } from "./icons";

// Mobile-only menu: a top-right button that opens a dropdown with the nav
// links (and Sign In when signed out). Hidden on desktop, where the links
// render inline instead.
export default function NavMenu({
  links,
  signIn,
  menuLabel,
}: {
  links: { href: string; label: string }[];
  signIn?: { href: string; label: string } | null;
  /** The button's name for screen readers, in the visitor's language. */
  menuLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Open for the page it was opened on: following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

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

  const current = activeHref(pathname, links.map((link) => link.href));

  return (
    <div className="nav__mobile" ref={ref}>
      <button
        type="button"
        className="nav__burger"
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <IconClose size={18} /> : <IconMenu size={18} />}
      </button>
      {open && (
        <div className="nav__drawer" role="menu">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={currentValue(pathname, link.href, current)}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {signIn && (
            <Link
              href={signIn.href}
              className="nav__drawer-cta"
              onClick={() => setOpen(false)}
            >
              {signIn.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
