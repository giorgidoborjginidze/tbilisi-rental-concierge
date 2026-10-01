"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "./icons";

// Light/dark toggle. The choice is written to the html element (instant)
// and to a cookie, so the server renders the right theme on reload with
// no flash. Light is the default; dark only when explicitly chosen.
// The icon follows the theme through CSS (html[data-theme]) — a moon
// offers dark, a sun offers light — so it is right from the first paint.
// aria-pressed says whether dark is on, for a screen reader (the icons
// alone say nothing to it).

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.dataset.theme === "dark";

export default function ThemeToggle({ label }: { label: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      className="btn-chip btn-chip--icon theme-toggle"
      onClick={toggle}
      aria-label={label}
      aria-pressed={dark}
      title={label}
    >
      <IconMoon size={15} className="theme-toggle__moon" />
      <IconSun size={15} className="theme-toggle__sun" />
    </button>
  );
}
