"use client";

import type { ReactNode } from "react";

// A submit button that asks first. Deleting a payment rewrites the
// schedule, so a stray tap must not do it silently.
export default function ConfirmSubmit({
  message,
  className,
  ariaLabel,
  children,
}: {
  message: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
