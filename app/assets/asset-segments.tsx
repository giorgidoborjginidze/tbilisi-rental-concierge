"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

// A single dropdown that filters which asset segment is shown: real estate,
// vehicles, salary/dividend, digital assets, or all. Each segment is a
// server-rendered node tagged with its group; we show or hide it. When the
// chosen segment (or everything, in "all") is empty, a call-to-action
// invites the user to add their first asset of that kind.
export default function AssetSegments({
  options,
  segments,
  ctaText,
}: {
  options: { value: string; label: string }[];
  segments: { group: string; node: ReactNode; empty: boolean; addHref: string }[];
  ctaText: string;
}) {
  const [filter, setFilter] = useState("all");

  const visible = segments.filter(
    (s) => !s.empty && (filter === "all" || s.group === filter),
  );
  const selected = filter === "all" ? null : segments.find((s) => s.group === filter);
  const showCta = filter === "all" ? segments.every((s) => s.empty) : (selected?.empty ?? true);
  const ctaHref = filter === "all" ? "/assets/new" : selected?.addHref ?? "/assets/new";

  return (
    <>
      <label className="field" style={{ maxWidth: 320, marginTop: 4 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {visible.map((s, i) => (
        <div key={i}>{s.node}</div>
      ))}

      {showCta && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "36px 24px", marginTop: 14 }}
        >
          <Link href={ctaHref} className="btn-primary" style={{ display: "inline-block" }}>
            {ctaText}
          </Link>
        </div>
      )}
    </>
  );
}
