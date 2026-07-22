"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. The choice is written to the html element (instant)
// and to a cookie, so the server renders the right theme on reload with
// no flash. No cookie = follow the OS setting.
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Light is the default; dark only when explicitly chosen.
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    // Read the live attribute so a click never depends on hydration
    // timing (default with no attribute counts as light).
    const isDark = document.documentElement.dataset.theme === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(next === "dark");
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
