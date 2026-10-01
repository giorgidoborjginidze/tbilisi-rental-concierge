"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// "Deleted — Undo": one toast for the whole app, mounted once in the
// layout. A delete announces itself here (ConfirmAction), so the offer
// outlives the row it came from — the row is gone the moment the server
// agrees, and with it anything that lived inside it.

export interface UndoOffer {
  message: string;
  undoLabel: string;
  /** Puts the thing back (a server action with the deleted row's fields). */
  run: () => Promise<unknown>;
}

const EVENT = "activo:undo";

export function announceUndo(offer: UndoOffer) {
  window.dispatchEvent(new CustomEvent<UndoOffer>(EVENT, { detail: offer }));
}

/** How long the offer stays: long enough to read and reach. */
const UNDO_MS = 10_000;

export default function UndoToast() {
  const router = useRouter();
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const listen = (event: Event) => setOffer((event as CustomEvent<UndoOffer>).detail);
    window.addEventListener(EVENT, listen);
    return () => window.removeEventListener(EVENT, listen);
  }, []);

  useEffect(() => {
    if (!offer) return;
    const timer = setTimeout(() => setOffer(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [offer]);

  return (
    <div className="decide-toast-slot undo-toast-slot" aria-live="polite">
      {offer && (
        <div className="decide-toast" role="status">
          <span>{offer.message}</span>
          <button
            type="button"
            className="btn-chip decide-act"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await offer.run();
                setOffer(null);
                router.refresh();
              })
            }
          >
            {offer.undoLabel}
          </button>
        </div>
      )}
    </div>
  );
}
