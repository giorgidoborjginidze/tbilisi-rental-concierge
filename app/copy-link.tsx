"use client";

import { useState } from "react";

/** A button that copies a link and says so for a moment. */
export default function CopyLink({ value, label, copied }: { value: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() =>
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          },
          () => undefined,
        )
      }
    >
      <span aria-live="polite">{done ? copied : label}</span>
    </button>
  );
}
