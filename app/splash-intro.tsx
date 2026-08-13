"use client";

import { useCallback, useEffect, useState } from "react";
import ActivoLogo from "./activo-logo";

// Logo-only intro shown on every visit to the home page. The full wordmark
// builds itself, then the screen fades. Auto-dismisses after a short beat,
// or immediately on tap. Rendered on first paint (SSR) so it covers the
// page with no flash.
export default function SplashIntro({ tapHint }: { tapHint: string }) {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => setGone(true), 420);
    // The hero logo below waits for this before building itself — an
    // animation played behind the splash would be over unseen.
    window.dispatchEvent(new Event("activo:splash-done"));
  }, []);

  useEffect(() => {
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
