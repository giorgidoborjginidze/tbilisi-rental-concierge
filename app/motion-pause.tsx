"use client";

import { useEffect } from "react";

// The landing page's looping decorations (the hero's aurora, the living
// dashboard miniature) run only while they are on screen: scrolled away,
// they are paused (CSS: [data-motion][data-offscreen]), so a phone is not
// kept busy repainting what nobody sees. Reduced motion stops them in CSS
// altogether.
export default function MotionPause() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-motion]"));
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) el.removeAttribute("data-offscreen");
          else el.setAttribute("data-offscreen", "");
        }
      },
      { rootMargin: "80px 0px" },
    );
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return null;
}
