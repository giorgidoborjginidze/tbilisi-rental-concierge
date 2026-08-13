"use client";

import { useState, type ReactNode } from "react";

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 15,
  height: 15,
  "aria-hidden": true,
};

type Tab = "re" | "car" | "flip";

// Free calculator tabs: buy-to-let, vehicle, flip. All stay mounted so
// values survive switching back and forth.
export default function InvestTabs({
  reLabel,
  carLabel,
  flipLabel,
  realEstate,
  car,
  flip,
}: {
  reLabel: string;
  carLabel: string;
  flipLabel: string;
  realEstate: ReactNode;
  car: ReactNode;
  flip: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("re");

  const tabs: { id: Tab; label: string; svg: ReactNode }[] = [
    {
      id: "re",
      label: reLabel,
      svg: (
        <svg {...icon}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M10 20v-5.5h4V20" />
        </svg>
      ),
    },
    {
      id: "car",
      label: carLabel,
      svg: (
        <svg {...icon}>
          <path d="M4.5 16.5v2H7v-2M17 16.5v2h2.5v-2" />
          <path d="M3 16.5v-4l1.9-4.4A2 2 0 0 1 6.7 7h10.6a2 2 0 0 1 1.8 1.1L21 12.5v4Z" />
          <path d="M3 12.5h18" />
          <circle cx="7.2" cy="14.5" r="1" />
          <circle cx="16.8" cy="14.5" r="1" />
        </svg>
      ),
    },
    {
      id: "flip",
      label: flipLabel,
      svg: (
        <svg {...icon}>
          <path d="M3 7h13l-3-3" />
          <path d="M21 17H8l3 3" />
          <path d="M17.5 5.5 21 7l-1.5 3.5" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"btn-chip " + (tab === t.id ? "btn-chip--active" : "")}
            onClick={() => setTab(t.id)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {t.svg}
            {t.label}
          </button>
        ))}
      </div>
      <div style={tab === "re" ? undefined : { display: "none" }}>{realEstate}</div>
      <div style={tab === "car" ? undefined : { display: "none" }}>{car}</div>
      <div style={tab === "flip" ? undefined : { display: "none" }}>{flip}</div>
    </div>
  );
}
