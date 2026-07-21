"use client";

import { useState, type ReactNode } from "react";

// Free calculator tabs: real estate vs vehicle. Both stay mounted so
// entered values survive switching back and forth.
export default function InvestTabs({
  reLabel,
  carLabel,
  realEstate,
  car,
}: {
  reLabel: string;
  carLabel: string;
  realEstate: ReactNode;
  car: ReactNode;
}) {
  const [tab, setTab] = useState<"re" | "car">("re");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={"btn-chip " + (tab === "re" ? "btn-chip--active" : "")}
          onClick={() => setTab("re")}
        >
          🏠 {reLabel}
        </button>
        <button
          type="button"
          className={"btn-chip " + (tab === "car" ? "btn-chip--active" : "")}
          onClick={() => setTab("car")}
        >
          🚗 {carLabel}
        </button>
      </div>
      <div style={tab === "re" ? undefined : { display: "none" }}>{realEstate}</div>
      <div style={tab === "car" ? undefined : { display: "none" }}>{car}</div>
    </div>
  );
}
