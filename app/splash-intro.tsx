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
  }, []);

  // Long enough for the wordmark to finish building itself (~1.7s) before
  // the screen fades; a tap still skips straight through.
  useEffect(() => {
    const timer = setTimeout(dismiss, 2150);
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
