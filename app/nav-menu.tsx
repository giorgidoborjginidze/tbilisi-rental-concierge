"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Mobile-only menu: a top-right button that opens a dropdown with the nav
// links (and Sign In when signed out). Hidden on desktop, where the links
// render inline instead.
export default function NavMenu({
  links,
  signIn,
}: {
  links: { href: string; label: string }[];
  signIn?: { href: string; label: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="nav__mobile" ref={ref}>
      <button
        type="button"
        className="nav__burger"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div className="nav__drawer" role="menu">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
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
