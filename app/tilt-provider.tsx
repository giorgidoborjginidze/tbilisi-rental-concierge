"use client";

import { useEffect } from "react";

// One document-level listener gives every depth card in the app a live,
// pointer-tracked tilt (the fixed hover tilt stays as the no-JS fallback).
// Cheap on purpose: a single rAF, transforms only, and it stands down
// entirely on touch screens and for reduced-motion users.
const SELECTOR = ".card3d, .feature-card, .kpi-grid--3d .kpi";
const MAX_DEG = 7;

export default function TiltProvider() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    let raf = 0;
    let target: HTMLElement | null = null;
    let last: PointerEvent | null = null;

    const reset = (el: HTMLElement) => {
      el.classList.remove("is-tilting");
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
    };

    const apply = () => {
      raf = 0;
      if (!target || !last) return;
      const r = target.getBoundingClientRect();
      if (r.width === 0) return;
      const x = (last.clientX - r.left) / r.width;
      const y = (last.clientY - r.top) / r.height;
      target.style.setProperty("--tilt-x", `${((0.5 - y) * MAX_DEG * 2).toFixed(2)}deg`);
      target.style.setProperty("--tilt-y", `${((x - 0.5) * MAX_DEG * 2).toFixed(2)}deg`);
      target.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      target.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      target.classList.add("is-tilting");
    };

    const onMove = (event: PointerEvent) => {
      const el = (event.target as HTMLElement).closest?.(
        SELECTOR,
      ) as HTMLElement | null;
      if (target && el !== target) reset(target);
      target = el;
      last = event;
      if (el && !raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (target) reset(target);
      target = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
