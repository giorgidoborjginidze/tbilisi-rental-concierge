"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { logout } from "@/lib/auth/actions";
import { DEMO_FLAG, DEMO_READONLY } from "@/lib/auth/demo";

// Shown to anyone signed in to the shared public demo: a thin ribbon under
// the nav, and — when a change was just refused (?demo=readonly, see
// lib/auth/session.ts requireWriter) — a note under the nav saying the
// change was not saved. "Register free" signs out of the demo first, since
// /register is only for signed-out visitors.
export default function DemoRibbon({
  labels,
}: {
  labels: { ribbon: string; readonly: string; cta: string; close: string };
}) {
  const params = useSearchParams();
  const refused = params.get(DEMO_FLAG) === DEMO_READONLY;
  // Closing hides this refusal; the next one (a new URL) shows again.
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const key = params.toString();

  const register = (text: string) => (
    <form action={logout}>
      <input type="hidden" name="next" value="/register" />
      <button type="submit" className="demo-ribbon__cta">
        {text}
      </button>
    </form>
  );

  // "…— register free": the call to action inside the sentence is the button.
  const at = labels.readonly.toLowerCase().indexOf(labels.cta.toLowerCase());
  const refusal =
    at >= 0 ? (
      <span>
        {labels.readonly.slice(0, at)}
        {register(labels.readonly.slice(at, at + labels.cta.length))}
        {labels.readonly.slice(at + labels.cta.length)}
      </span>
    ) : (
      <span>
        {labels.readonly} {register(labels.cta)}
      </span>
    );

  return (
    <>
      <div className="demo-ribbon" role="note">
        <span className="demo-ribbon__tag">DEMO</span>
        <span className="demo-ribbon__text">{labels.ribbon}</span>
        {register(labels.cta)}
      </div>
      {refused && closedFor !== key && (
        <div className="demo-toast" role="status">
          {refusal}
          <span className="demo-toast__acts">
            <button
              type="button"
              className="demo-toast__close"
              aria-label={labels.close}
              title={labels.close}
              onClick={() => setClosedFor(key)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        </div>
      )}
    </>
  );
}
