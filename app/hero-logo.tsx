"use client";

import { useEffect, useState } from "react";
import ActivoLogo from "./activo-logo";

// The landing hero's logo builds itself the same way the splash one does.
// It has to wait: the splash covers the page for the first couple of
// seconds, and an animation that plays behind a cover has already finished
// by the time anyone can see it. So it holds until the splash says it is
// done, then starts.
export default function HeroLogo({ height = 52 }: { height?: number }) {
  const [start, setStart] = useState(false);

  useEffect(() => {
    const go = () => setStart(true);
    window.addEventListener("activo:splash-done", go);
    // Fallback for any route that shows the hero without a splash.
    const timer = setTimeout(go, 3200);
    return () => {
      window.removeEventListener("activo:splash-done", go);
      clearTimeout(timer);
    };
  }, []);

  // Hidden until it can actually be watched, so it never appears
  // half-built.
  return (
    <div style={{ opacity: start ? 1 : 0, height }}>
      {start && <ActivoLogo height={height} animated />}
    </div>
  );
}
