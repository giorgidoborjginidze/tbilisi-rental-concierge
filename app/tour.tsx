"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TourStep {
  /** Page the step lives on. */
  path: string;
  /** CSS selector of the element to spotlight. */
  target: string;
  title: string;
  body: string;
}

const KEY = "activo:tour"; // current step index, persisted across pages
const SEEN = "activo:tour-seen";

const read = (): number | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? null : Number(raw);
  } catch {
    return null;
  }
};

/** Start (or restart) the tour from anywhere in the app. */
export const startTour = () => {
  try {
    localStorage.setItem(KEY, "0");
    localStorage.setItem(SEEN, "1");
  } catch {}
  window.dispatchEvent(new Event("activo:tour-start"));
};

// Guided tour engine: a dimming backdrop with a spotlight hole over the
// current step's element and a card explaining it. Steps can live on
// different pages — the index is kept in localStorage, so the tour simply
// resumes after each navigation. A step whose target never appears (a
// profile without that section) is skipped instead of blocking.
export default function Tour({
  steps,
  labels,
}: {
  steps: TourStep[];
  labels: { next: string; back: string; skip: string; done: string };
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const elRef = useRef<Element | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wake up on mount, after navigation, and when something starts the tour.
  useEffect(() => {
    const sync = () => setIdx(read());
    sync();
    window.addEventListener("activo:tour-start", sync);
    return () => window.removeEventListener("activo:tour-start", sync);
  }, [pathname]);

  const stop = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
      localStorage.setItem(SEEN, "1");
    } catch {}
    setIdx(null);
    setRect(null);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= steps.length) {
        stop();
        return;
      }
      try {
        localStorage.setItem(KEY, String(next));
      } catch {}
      setRect(null);
      setIdx(next);
      if (steps[next].path !== window.location.pathname) {
        router.push(steps[next].path);
      }
    },
    [steps, router, stop],
  );

  const step = idx == null ? null : steps[idx];
  const onStepPage = step != null && pathname === step.path;

  // Find and track the target element once we are on the step's page.
  useEffect(() => {
    if (!step || !onStepPage) return;

    let cancelled = false;
    let tries = 0;
    const locate = () => {
      const el = document.querySelector(step.target);
      if (el) {
        elRef.current = el;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const measure = () => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        };
        // Let the scroll settle before the first measure.
        setTimeout(measure, 350);
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        cleanup = () => {
          window.removeEventListener("scroll", measure);
          window.removeEventListener("resize", measure);
        };
        return true;
      }
      return false;
    };

    let cleanup = () => {};
    if (!locate()) {
      // The splash or data may still be loading — poll briefly, then skip
      // the step entirely rather than stranding the visitor.
      pollRef.current = setInterval(() => {
        tries += 1;
        if (locate()) {
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (tries > 14) {
          if (pollRef.current) clearInterval(pollRef.current);
          goTo((read() ?? 0) + 1);
        }
      }, 300);
    }
    return () => {
      cancelled = true;
      cleanup();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, onStepPage, goTo]);

  if (!step || !onStepPage || !rect || idx == null) return null;

  const pad = 8;
  const top = Math.max(rect.top - pad, 0);
  const left = Math.max(rect.left - pad, 0);
  const width = Math.min(rect.width + pad * 2, window.innerWidth - left);
  const height = rect.height + pad * 2;

  // Card below the target when there is room, above it otherwise.
  const below = top + height + 190 < window.innerHeight;
  const cardTop = below ? top + height + 12 : undefined;
  const cardBottom = below ? undefined : window.innerHeight - top + 12;

  return (
    <div className="tour" role="dialog" aria-label={step.title}>
      <div
        className="tour__spot"
        style={{ top, left, width, height }}
      />
      <div
        className="tour__card"
        style={{ top: cardTop, bottom: cardBottom }}
      >
        <div className="tour__count">
          {idx + 1} / {steps.length}
        </div>
        <div className="tour__title">{step.title}</div>
        <p className="tour__body">{step.body}</p>
        <div className="tour__actions">
          <button type="button" className="tour__skip" onClick={stop}>
            {labels.skip}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {idx > 0 && (
              <button type="button" className="btn-secondary tour__btn" onClick={() => goTo(idx - 1)}>
                {labels.back}
              </button>
            )}
            <button type="button" className="btn-primary tour__btn" onClick={() => goTo(idx + 1)}>
              {idx === steps.length - 1 ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
