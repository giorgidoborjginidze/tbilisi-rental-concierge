"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. The choice is written to the html element (instant)
// and to a cookie, so the server renders the right theme on reload with
// no flash. No cookie = follow the OS setting.
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const forced = document.documentElement.dataset.theme;
    setDark(
      forced
        ? forced === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(!dark);
  };

  return (
    <button
      type="button"
      className="btn-chip"
      onClick={toggle}
      aria-label="theme"
      suppressHydrationWarning
    >
      {dark == null ? "🌗" : dark ? "☀️" : "🌙"}
    </button>
  );
}
