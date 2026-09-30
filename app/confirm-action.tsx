"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A destructive action that asks first — inside the page, never with the
// browser's confirm() box. The first tap only opens a short question next
// to the button ("Delete this contract? Its payments are kept for 30
// days." [Delete] [Cancel]); only the second, deliberate tap runs the
// server action. The trigger keeps its small look but gets a 44 px touch
// target, so a thumb slip while scrolling does not land on it either.
//
// Server pages pass the server action and its hidden fields; the component
// renders its own <form>, so it must not sit inside another form.

function ConfirmButton({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
      {children}
    </button>
  );
}

export default function ConfirmAction({
  action,
  fields,
  trigger,
  triggerClassName = "btn-chip btn-chip--icon btn-chip--danger",
  ariaLabel,
  question,
  confirmLabel,
  cancelLabel,
  confirmClassName = "btn-danger btn-compact",
  inline = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden fields posted with the action (ids). */
  fields: Record<string, string>;
  /** What the trigger shows: an icon or a word. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Accessible name of an icon-only trigger. */
  ariaLabel?: string;
  /** The question: what goes, and whether it can come back. */
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmClassName?: string;
  /** Keep the question on the trigger's line (tables, chip rows). */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Focus follows the question: onto "Cancel" when it opens (the safe
  // choice), back onto the trigger when it closes.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName} confirm-trigger`}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>
    );
  }

  return (
    <form
      // Close the question once the action has run: an action that keeps
      // this component mounted (rotating a tracker key) must not leave a
      // second "confirm" on screen that would run it again.
      action={async (formData: FormData) => {
        await action(formData);
        setOpen(false);
      }}
      className={`confirm-inline${inline ? " confirm-inline--row" : ""}`}
      role="alertdialog"
      aria-label={question}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className="confirm-inline__q">{question}</span>
      <span className="confirm-inline__actions">
        <ConfirmButton className={confirmClassName}>{confirmLabel}</ConfirmButton>
        <button ref={cancelRef} type="button" className="btn-chip" onClick={() => setOpen(false)}>
          {cancelLabel}
        </button>
      </span>
    </form>
  );
}
