"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveRent, undoPayment } from "@/lib/rentals/actions";
import { formatDue } from "@/lib/rentals/money";
import { IconArrowRight, IconCheck } from "./icons";

export interface DecideItem {
  contractId: string;
  assetId: string;
  /** The asset's display name. */
  name: string;
  title: string;
  sub: string;
  /** Outstanding amount; recording it advances the schedule fully. */
  amount: number;
  currency: string;
  /** Unpaid periods already due — more than one asks before recording. */
  periodsOwed: number;
  severe: boolean;
}

export interface DecideLabels {
  paid: string;
  open: string;
  empty: string;
  confirm: string;
  confirmYes: string;
  confirmNo: string;
  recorded: string;
  undo: string;
  undone: string;
  error: string;
  showAll: string;
  showLess: string;
  close: string;
  /** Server error keys (error_*) in the owner's language. */
  errors: Record<string, string>;
}

type Toast =
  | { kind: "recorded"; item: DecideItem; paymentId: string }
  | { kind: "undone" }
  | { kind: "error"; message: string };

/** Cards shown before "show all" — the rest are one tap away, never cut. */
const FIRST = 4;

// Rounded up to the tetri: recording the amount shown settles it exactly.
const fmt = formatDue;

// The demo's "confirm with a flick", wired to real money: swipe right
// records the outstanding rent as received (a real RentPayment row),
// swipe left opens the asset's rental service page. The buttons do the
// same with a mouse, a keyboard or a tap. When more than one period is
// owed the card asks first; every recording can be undone straight away,
// and a refusal from the server is shown, never swallowed.
export default function DecideCards({
  items,
  labels,
}: {
  items: DecideItem[];
  labels: DecideLabels;
}) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const left = items.filter((item) => !gone.includes(item.contractId));
  const shown = expanded ? left : left.slice(0, FIRST);

  // The undo offer stays long enough to read and reach; the rest fade sooner.
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const timer = setTimeout(() => setToast(null), toast.kind === "recorded" ? 12_000 : 4_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const errorText = (key: string) => labels.errors[key] ?? labels.errors.error_required;

  const record = (item: DecideItem) => {
    setConfirming(null);
    setGone((prev) => [...prev, item.contractId]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("contractId", item.contractId);
      fd.set("assetId", item.assetId);
      fd.set("amount", String(item.amount));
      fd.set("method", "cash");
      let result: Awaited<ReturnType<typeof receiveRent>>;
      try {
        result = await receiveRent(fd);
      } catch {
        result = { error: "error_required" };
      }
      if ("error" in result) {
        // Nothing was recorded: the card comes back with the reason.
        setGone((prev) => prev.filter((id) => id !== item.contractId));
        setToast({ kind: "error", message: `${labels.error}: ${item.name} — ${errorText(result.error)}` });
        return;
      }
      setToast({ kind: "recorded", item, paymentId: result.paymentId });
      router.refresh();
    });
  };

  const paid = (item: DecideItem) => {
    if (item.periodsOwed > 1) setConfirming(item.contractId);
    else record(item);
  };

  const undo = (item: DecideItem, paymentId: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("assetId", item.assetId);
      fd.set("paymentId", paymentId);
      let result: Awaited<ReturnType<typeof undoPayment>>;
      try {
        result = await undoPayment(fd);
      } catch {
        result = { error: "error_required" };
      }
      if ("error" in result) {
        setToast({ kind: "error", message: `${item.name} — ${errorText(result.error)}` });
        return;
      }
      setGone((prev) => prev.filter((id) => id !== item.contractId));
      setToast({ kind: "undone" });
      router.refresh();
    });
  };

  return (
    <>
      {left.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{labels.empty}</p>
      ) : (
        <div className="decide-zone">
          {shown.map((item) =>
            confirming === item.contractId ? (
              <div key={item.contractId} className="decide-card">
                <div className="decide-top decide-confirm" role="group" aria-label={item.title}>
                  <span className="decide-txt">
                    <b>{item.title}</b>
                    <span>
                      {labels.confirm
                        .replace("{n}", String(item.periodsOwed))
                        .replace("{amount}", `${fmt(item.amount)} ${item.currency}`)}
                    </span>
                  </span>
                  <span className="decide-confirm__actions">
                    <button
                      type="button"
                      className="btn-primary decide-confirm__yes"
                      onClick={() => record(item)}
                      disabled={pending}
                      autoFocus
                    >
                      {labels.confirmYes}
                    </button>
                    <button
                      type="button"
                      className="btn-chip decide-act"
                      onClick={() => setConfirming(null)}
                    >
                      {labels.confirmNo}
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <Card
                key={item.contractId}
                item={item}
                labels={labels}
                onPaid={() => paid(item)}
                onOpen={() => router.push(`/assets/${item.assetId}/rental`)}
              />
            ),
          )}
        </div>
      )}

      {left.length > FIRST && (
        <button
          type="button"
          className="btn-chip decide-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? labels.showLess : labels.showAll.replace("{n}", String(left.length))}
        </button>
      )}

      <div className="decide-toast-slot" aria-live="polite">
        {toast && (
          <div className={`decide-toast${toast.kind === "error" ? " decide-toast--error" : ""}`} role="status">
            <span>
              {toast.kind === "recorded"
                ? labels.recorded
                    .replace("{amount}", `${fmt(toast.item.amount)} ${toast.item.currency}`)
                    .replace("{name}", toast.item.name)
                : toast.kind === "undone"
                  ? labels.undone
                  : toast.message}
            </span>
            {toast.kind === "recorded" && (
              <button
                type="button"
                className="btn-chip decide-act"
                disabled={pending}
                onClick={() => undo(toast.item, toast.paymentId)}
              >
                {labels.undo}
              </button>
            )}
            {toast.kind === "error" && (
              <button
                type="button"
                className="btn-chip decide-act"
                aria-label={labels.close}
                title={labels.close}
                onClick={() => setToast(null)}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Card({
  item,
  labels,
  onPaid,
  onOpen,
}: {
  item: DecideItem;
  labels: { paid: string; open: string };
  onPaid: () => void;
  onOpen: () => void;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; dx: number; captured: boolean } | null>(null);

  const reset = () => {
    const top = topRef.current;
    if (!top) return;
    top.style.transition = "transform .22s ease";
    top.style.transform = "";
    setTimeout(() => {
      if (topRef.current) topRef.current.style.transition = "";
    }, 240);
  };

  const flyOut = (dir: "yes" | "no", then: () => void) => {
    const top = topRef.current;
    if (!top) return then();
    top.style.transition = "transform .28s ease, opacity .28s ease";
    top.style.transform = `translateX(${dir === "yes" ? 480 : -480}px) rotate(${dir === "yes" ? 7 : -7}deg)`;
    top.style.opacity = "0";
    setTimeout(then, 240);
  };

  // Right: received — straight away for one period; with more owed the
  // card comes back and asks first. Left: open the details.
  const decide = (dir: "yes" | "no") => {
    if (dir === "no") return flyOut("no", onOpen);
    if (item.periodsOwed > 1) {
      reset();
      onPaid();
      return;
    }
    flyOut("yes", onPaid);
  };

  const finish = () => {
    const state = drag.current;
    drag.current = null;
    if (!state?.captured) return;
    if (Math.abs(state.dx) > 90) decide(state.dx > 0 ? "yes" : "no");
    else reset();
  };

  return (
    <div className="decide-card">
      <div className="decide-under" aria-hidden>
        <span className="yes">{labels.paid}</span>
        <span className="no">{labels.open}</span>
      </div>
      <div
        ref={topRef}
        className="decide-top"
        role="group"
        aria-label={item.title}
        onPointerDown={(e) => {
          // A press on a button is a click, not the start of a swipe:
          // capturing the pointer here would steal the button's click.
          if ((e.target as HTMLElement).closest("button, a")) return;
          drag.current = { x0: e.clientX, dx: 0, captured: false };
          e.currentTarget.style.transition = "";
        }}
        onPointerMove={(e) => {
          const state = drag.current;
          if (!state || !topRef.current) return;
          state.dx = e.clientX - state.x0;
          // Only a real sideways drag takes the pointer.
          if (!state.captured) {
            if (Math.abs(state.dx) < 8) return;
            state.captured = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          topRef.current.style.transform = `translateX(${state.dx}px) rotate(${state.dx / 40}deg)`;
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = null;
          reset();
        }}
      >
        <span
          className="decide-ico"
          style={{
            background: item.severe
              ? "linear-gradient(140deg,#f5cdd9,#e08ba4)"
              : "linear-gradient(140deg,#bdf0e0,#6ed3b8)",
          }}
        >
          ₾
        </span>
        <span className="decide-txt">
          <b>{item.title}</b>
          <span>{item.sub}</span>
        </span>
        <span className="decide-amount">
          {fmt(item.amount)} {item.currency}
        </span>
        <span className="decide-acts">
          <button
            type="button"
            className="btn-chip decide-act"
            aria-label={labels.paid}
            title={labels.paid}
            onClick={() => decide("yes")}
          >
            <IconCheck size={16} />
          </button>
          <button
            type="button"
            className="btn-chip decide-act"
            aria-label={labels.open}
            title={labels.open}
            onClick={() => decide("no")}
          >
            <IconArrowRight size={16} />
          </button>
        </span>
      </div>
    </div>
  );
}
