"use client";

import { useState, type ReactNode } from "react";

// A <details> fold whose open state belongs to the page the owner is on.
// The server decides only how it starts (e.g. open while an asset has no
// contract yet); after that the owner's own toggling wins, and a server
// re-render after a save (which may now say "start closed") does not fold
// away the form together with its "saved" line.
export default function KeepOpenFold({
  initialOpen,
  summary,
  className = "desk-fold",
  children,
}: {
  initialOpen: boolean;
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
