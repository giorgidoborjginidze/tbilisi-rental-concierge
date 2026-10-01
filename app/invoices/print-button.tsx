"use client";

/** Print, or "Save as PDF" in the print dialog. */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
