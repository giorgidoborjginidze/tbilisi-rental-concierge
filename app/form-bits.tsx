import type { ReactNode } from "react";
import { IconCheck } from "./icons";

// Small pieces every form uses the same way.

/**
 * The mark of a required field. The input itself carries `required` and
 * `aria-required`, so a screen reader says it; the star is for the eye.
 */
export function Req() {
  return (
    <span className="req" aria-hidden="true">
      *
    </span>
  );
}

/** "* required" — said once, above a form that marks its required fields. */
export function RequiredLegend({ text }: { text: string }) {
  return (
    <p className="form-legend">
      <span className="req" aria-hidden="true">
        *
      </span>{" "}
      {text}
    </p>
  );
}

/** What a save did: an error (with its detail), or a short "saved" line. */
export function FormMessage({
  error,
  detail,
  saved,
  className,
}: {
  error?: string | null;
  detail?: string | null;
  saved?: ReactNode;
  className?: string;
}) {
  if (error) {
    return (
      <p className={`form-error ${className ?? ""}`} role="alert">
        {error}
        {detail ? ` ${detail}` : ""}
      </p>
    );
  }
  if (saved) {
    return (
      <p className={`form-saved ${className ?? ""}`} role="status">
        <IconCheck size={15} /> {saved}
      </p>
    );
  }
  return null;
}
