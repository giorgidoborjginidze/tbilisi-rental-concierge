"use client";

import { useEffect, useRef, useState } from "react";
import { afterSplash } from "@/lib/ui/splash";

// A number that counts up when it scrolls into view — once the splash (if
// the page has one) is gone, so the count is not played unseen behind it.
// Reduced-motion users (and pre-hydration paint) see the final value
// immediately.
export default function CountUp({
  to,
  duration = 1100,
  prefix = "",
  suffix = "",
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            // ease-out cubic — fast start, gentle landing on the real value
            setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          setValue(0);
          raf = requestAnimationFrame(tick);
        },
        { threshold: 0.5 },
      );
      observer.observe(el);
    };
    const stopWaiting = afterSplash(watch);
    return () => {
      stopWaiting();
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
