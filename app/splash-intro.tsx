"use client";

import { useCallback, useEffect, useState } from "react";
import AppMark from "./app-mark";

// Logo-only intro shown on every visit to the home page. Auto-dismisses
// after a short beat, or immediately on tap. Rendered on first paint (SSR)
// so it covers the page with no flash, then fades out.
export default function SplashIntro({ tapHint }: { tapHint: string }) {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => setGone(true), 420);
  }, []);

  useEffect(() => {
    const timer = setTimeout(dismiss, 1600);
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
        <AppMark size={104} />
      </div>
      <div className="splash__word">Activo</div>
      <div className="splash__hint">{tapHint}</div>
    </div>
  );
}
