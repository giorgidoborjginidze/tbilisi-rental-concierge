"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { receiveRent, undoPayment } from "@/lib/rentals/actions";
import { currencySign, formatDueMoney } from "@/lib/format";
import { IconArrowRight, IconCheck, IconClose } from "./icons";

export interface DecideItem {
  contractId: string;
  assetId: string;
  /** Where "open" (swipe left) leads: the asset's desk, on its payments. */
  href: string;
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
  /** A car: "Today" then links to the whole fleet list. */
  vehicle?: boolean;
  /** Other urgent facts about the same asset (outside its red line…). */
  flags: { label: string; tone: "danger" | "warn" }[];
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
const fmt = formatDueMoney;

interface DecideHost {
  labels: DecideLabels;
  pending: boolean;
  toast: Toast | null;
  setToast: (toast: Toast | null) => void;
  run: (job: () => Promise<void>) => void;
  /** Cards recorded on this screen, hidden until the server agrees. */
  gone: string[];
  setGone: (update: (prev: string[]) => string[]) => void;
}

const HostContext = createContext<DecideHost | null>(null);

function useHost(): DecideHost {
  const host = useContext(HostContext);
  if (!host) throw new Error("DecideCards needs a DecideToastHost");
  return host;
}

/**
 * Holds the "recorded — undo" offer for every block of rent cards in
 * "Today". It sits outside the blocks on purpose: recording the last late
 * rent makes the server drop the card block entirely, and the undo offer
 * must outlive it (an accidental swipe on the last card stays undoable).
 */
export function DecideToastHost({ labels, children }: { labels: DecideLabels; children: ReactNode }) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  // The undo offer stays long enough to read and reach; the rest fade sooner.
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const timer = setTimeout(() => setToast(null), toast.kind === "recorded" ? 12_000 : 4_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const errorText = (key: string) => labels.errors[key] ?? labels.errors.error_required;

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
      // An undone card comes back.
      setGone((prev) => prev.filter((id) => id !== item.contractId));
      setToast({ kind: "undone" });
      router.refresh();
    });
  };

  return (
    <HostContext.Provider
      value={{ labels, pending, toast, setToast, run: (job) => startTransition(job), gone, setGone }}
    >
      {children}
      <div className="decide-toast-slot" aria-live="polite">
        {toast && (
          <div className={`decide-toast${toast.kind === "error" ? " decide-toast--error" : ""}`} role="status">
            <span>
              {toast.kind === "recorded"
                ? labels.recorded
                    .replace("{amount}", fmt(toast.item.amount, toast.item.currency))
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
                <IconClose size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </HostContext.Provider>
  );
}

// The demo's "confirm with a flick", wired to real money: swipe right
// records the outstanding rent as received (a real RentPayment row),
// swipe left opens the asset's rental service page. The buttons do the
// same with a mouse, a keyboard or a tap. When more than one period is
// owed the card asks first; every recording can be undone straight away
// (the offer lives in DecideToastHost), and a refusal from the server is
// shown, never swallowed.
export default function DecideCards({ items }: { items: DecideItem[] }) {
  const router = useRouter();
  const { labels, pending, setToast, run, gone, setGone } = useHost();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const left = items.filter((item) => !gone.includes(item.contractId));
  const shown = expanded ? left : left.slice(0, FIRST);

  const errorText = (key: string) => labels.errors[key] ?? labels.errors.error_required;

  const record = (item: DecideItem) => {
    setConfirming(null);
    setGone((prev) => [...prev, item.contractId]);
    run(async () => {
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
                        .replace("{amount}", fmt(item.amount, item.currency))}
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
                onOpen={() => router.push(item.href)}
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
    if (!state?.captured) {
      // Never leave the card displaced by a press that did not become a swipe.
      if (topRef.current?.style.transform) reset();
      return;
    }
    if (Math.abs(state.dx) > 90) decide(state.dx > 0 ? "yes" : "no");
    else reset();
  };

  /** Forget a press that never turned into a swipe (released elsewhere). */
  const abandon = () => {
    const state = drag.current;
    if (!state || state.captured) return;
    drag.current = null;
    if (topRef.current?.style.transform) reset();
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
          if ((e.target as HTMLElement).closest("button, a")) {
            drag.current = null;
            return;
          }
          drag.current = { x0: e.clientX, dx: 0, captured: false };
          e.currentTarget.style.transition = "";
        }}
        onPointerMove={(e) => {
          const state = drag.current;
          if (!state || !topRef.current) return;
          // No button held: the press ended somewhere we did not see (it
          // left the card before becoming a swipe). A hover is not a drag.
          if (e.buttons === 0) {
            if (state.captured) {
              // Never decide on a release we did not see: just put it back.
              drag.current = null;
              reset();
            } else abandon();
            return;
          }
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
        onPointerLeave={abandon}
        onPointerCancel={() => {
          drag.current = null;
          reset();
        }}
      >
        {/* Rent due or in its grace days is amber; past the grace period red. */}
        <span className="decide-ico" data-sev={item.severe ? "danger" : "warn"} aria-hidden>
          {currencySign(item.currency)}
        </span>
        <span className="decide-txt">
          <b>{item.title}</b>
          <span>{item.sub}</span>
          {item.flags.length > 0 && (
            <span className="decide-flags">
              {item.flags.map((flag) => (
                <span key={flag.label} className={`badge badge--sm badge--${flag.tone}`}>
                  {flag.label}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="decide-amount">
          {fmt(item.amount, item.currency)}
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
