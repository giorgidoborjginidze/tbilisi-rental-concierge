"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEMO_FLAG, DEMO_READONLY } from "@/lib/auth/demo";

// A view-only team member whose change was just refused (requireWriter
// sends them back with the same ?demo=readonly flag as the demo): one
// note saying why, under the nav.
export default function ViewerNotice({ text, close }: { text: string; close: string }) {
  const params = useSearchParams();
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const key = params.toString();
  if (params.get(DEMO_FLAG) !== DEMO_READONLY || closedFor === key) return null;
  return (
    <div className="demo-toast" role="status">
      <span>{text}</span>
      <span className="demo-toast__acts">
        <button type="button" className="demo-toast__close" aria-label={close} title={close} onClick={() => setClosedFor(key)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    </div>
  );
}
