"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";

// Account chip + dropdown (Claude-style): avatar, Latin username · plan, and
// a menu with Settings / Billing / Log Out. Closes on outside click or Esc.
export default function AccountMenu({
  name,
  plan,
  initial,
  labels,
}: {
  name: string;
  plan: string;
  initial: string;
  labels: { settings: string; billing: string; logout: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="account-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="account-avatar">{initial}</span>
        <span className="account-label hidden sm:inline">
          {name} · {plan}
        </span>
        <span aria-hidden style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <Link href="/settings" className="account-menu__item" onClick={() => setOpen(false)}>
            {labels.settings}
          </Link>
          <Link href="/billing" className="account-menu__item" onClick={() => setOpen(false)}>
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
