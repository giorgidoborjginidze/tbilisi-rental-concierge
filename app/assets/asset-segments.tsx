"use client";

import { useState, type ReactNode } from "react";

// A single dropdown that filters which asset segment is shown: real estate,
// vehicles, salary/dividend, digital assets, or all. Each segment is a
// server-rendered node tagged with its group; we just show or hide it.
export default function AssetSegments({
  options,
  segments,
}: {
  options: { value: string; label: string }[];
  segments: { group: string; node: ReactNode }[];
}) {
  const [filter, setFilter] = useState("all");

  return (
    <>
      <label className="field" style={{ maxWidth: 320, marginTop: 4 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {segments.map((s, i) => (
        <div
          key={i}
          style={{ display: filter === "all" || filter === s.group ? undefined : "none" }}
        >
          {s.node}
        </div>
      ))}
    </>
  );
}
