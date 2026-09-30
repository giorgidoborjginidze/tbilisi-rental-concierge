"use client";

import { useEffect, useState } from "react";
import ActivoLogo from "./activo-logo";
import { afterSplash } from "@/lib/ui/splash";

// The landing hero's logo builds itself the same way the splash one does.
// When the splash is up it waits for it — an animation that plays behind a
// cover is over by the time anyone can see it — and without a splash (a
// second visit this session) it builds at once.
export default function HeroLogo({ height = 52 }: { height?: number }) {
  const [start, setStart] = useState(false);

  useEffect(() => afterSplash(() => setStart(true)), []);

  // Hidden until it can actually be watched, so it never appears
  // half-built.
  return (
    <div style={{ opacity: start ? 1 : 0, height }}>
      {start && <ActivoLogo height={height} animated />}
    </div>
  );
}
