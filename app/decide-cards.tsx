"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/lib/rentals/actions";

export interface DecideItem {
  contractId: string;
  assetId: string;
  title: string;
  sub: string;
  /** Outstanding amount; recording it advances the schedule fully. */
  amount: number;
  currency: string;
  severe: boolean;
}

// The demo's "confirm with a flick", wired to real money: swipe right
// records the outstanding rent as received (a real RentPayment row),
// swipe left opens the asset's rental service page. Buttons do the same
// for keyboards and anyone who does not want to drag.
export default function DecideCards({
  items,
  labels,
}: {
  items: DecideItem[];
  labels: { paid: string; open: string; empty: string };
}) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const left = items.filter((item) => !gone.includes(item.contractId));

  const settle = (item: DecideItem, dir: "yes" | "no") => {
    setGone((prev) => [...prev, item.contractId]);
    if (dir === "yes") {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("contractId", item.contractId);
        fd.set("assetId", item.assetId);
        fd.set("amount", String(item.amount));
        fd.set("method", "cash");
        await recordPayment(null, fd);
        router.refresh();
      });
    } else {
      router.push(`/assets/${item.assetId}/rental`);
    }
  };

  if (left.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{labels.empty}</p>;
  }

  return (
    <div className="decide-zone">
      {left.map((item) => (
        <Card key={item.contractId} item={item} labels={labels} onSettle={settle} />
      ))}
    </div>
  );
}

function Card({
  item,
  labels,
  onSettle,
}: {
  item: DecideItem;
  labels: { paid: string; open: string };
  onSettle: (item: DecideItem, dir: "yes" | "no") => void;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; dx: number } | null>(null);

  const finish = (commit: boolean) => {
    const top = topRef.current;
    const state = drag.current;
    drag.current = null;
    if (!top || !state) return;
    if (commit) {
      const dir = state.dx > 0 ? "yes" : "no";
      top.style.transition = "transform .28s ease, opacity .28s ease";
      top.style.transform = `translateX(${state.dx > 0 ? 480 : -480}px) rotate(${state.dx > 0 ? 7 : -7}deg)`;
      top.style.opacity = "0";
      setTimeout(() => onSettle(item, dir), 240);
    } else {
      top.style.transition = "transform .22s ease";
      top.style.transform = "";
      setTimeout(() => {
        if (topRef.current) topRef.current.style.transition = "";
      }, 240);
    }
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
          drag.current = { x0: e.clientX, dx: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.transition = "";
        }}
        onPointerMove={(e) => {
          if (!drag.current || !topRef.current) return;
          drag.current.dx = e.clientX - drag.current.x0;
          topRef.current.style.transform = `translateX(${drag.current.dx}px) rotate(${drag.current.dx / 40}deg)`;
        }}
        onPointerUp={() => finish(Math.abs(drag.current?.dx ?? 0) > 90)}
        onPointerCancel={() => finish(false)}
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
          {Math.round(item.amount).toLocaleString("en-US")} {item.currency}
        </span>
        <span style={{ display: "flex", gap: 6, marginLeft: 8, flex: "0 0 auto" }}>
          <button
            type="button"
            className="btn-chip"
            aria-label={labels.paid}
            onClick={() => {
              if (topRef.current) {
                drag.current = { x0: 0, dx: 120 };
                finish(true);
              }
            }}
          >
            ✓
          </button>
          <button
            type="button"
            className="btn-chip"
            aria-label={labels.open}
            onClick={() => onSettle(item, "no")}
          >
            →
          </button>
        </span>
      </div>
    </div>
  );
}
