"use client";

import { useEffect, useState } from "react";
import { startTour } from "./tour";

// One-time invitation on the dashboard: offers the guided tour to anyone
// who has never seen it. Either choice records the visit, so it never
// nags. Waits out the splash before appearing.
export default function TourPrompt({
  labels,
}: {
  labels: { title: string; body: string; start: string; later: string };
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("activo:tour-seen")) return;
      if (localStorage.getItem("activo:tour")) return; // already mid-tour
    } catch {
      return;
    }
    const timer = setTimeout(() => setShow(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("activo:tour-seen", "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="tour-prompt" role="dialog" aria-label={labels.title}>
      <div className="tour-prompt__title">{labels.title}</div>
      <p className="tour-prompt__body">{labels.body}</p>
      <div className="tour-prompt__actions">
        <button
          type="button"
          className="btn-primary tour__btn"
          onClick={() => {
            setShow(false);
            startTour();
          }}
        >
          {labels.start}
        </button>
        <button type="button" className="tour__skip" onClick={dismiss}>
          {labels.later}
        </button>
      </div>
    </div>
  );
}
