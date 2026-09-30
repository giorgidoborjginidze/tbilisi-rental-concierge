"use client";

import { useCallback, useEffect, useState } from "react";
import ActivoLogo from "./activo-logo";
import { SPLASH_COOKIE, SPLASH_DONE_EVENT } from "@/lib/ui/splash";

// Logo-only intro for a signed-out visitor's first look at the landing
// page — at most once per browser session (lib/ui/splash.ts): the server
// leaves it out once the session cookie set here exists, and never shows
// it to a signed-in owner. The full wordmark builds itself, then the
// screen fades; a tap skips it. Rendered on first paint (SSR) so it
// covers the page with no flash.
export default function SplashIntro({ tapHint }: { tapHint: string }) {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => setGone(true), 420);
    // The hero logo and the counters below wait for this before they
    // play — an animation behind the splash would be over unseen.
    window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
  }, []);

  useEffect(() => {
    // Seen once this browser session: a session cookie (no expiry).
    document.cookie = `${SPLASH_COOKIE}=1; path=/; SameSite=Lax`;
    // With reduced motion the mark renders finished, so there is nothing
    // to watch — hold it just long enough to register, then move on
    // rather than parking the visitor in front of a still image.
    const stillImage = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(dismiss, stillImage ? 800 : 2150);
    return () => clearTimeout(timer);
  }, [dismiss]);

  if (gone) return null;

  return (
    <div
      className={`splash${leaving ? " splash--leaving" : ""}`}
      onClick={dismiss}
      role="button"
      aria-label={tapHint}
    >
      <div className="splash__logo">
        <ActivoLogo height={64} animated />
      </div>
      <div className="splash__hint">{tapHint}</div>
    </div>
  );
}
