"use client";

import { useTransition } from "react";
import { setAssetStatus } from "@/lib/assets/actions";

export interface ListingLink {
  /** Platform key — maps to a .brandmark--* variant. */
  platform: string; // "myhome" | "ss" | "myauto" | "airbnb" | "booking"
  label: string; // "myhome.ge" | "ss.ge" | "myauto.ge" | "Airbnb" | "Booking.com"
  url: string;
}

// Branded platform chip, exactly as in the approved design:
// <a class="brandmark brandmark--myhome"><b>myhome</b><span>.ge</span></a>
export function Brandmark({ link }: { link: ListingLink }) {
  const dot = link.label.indexOf(".");
  const head = dot > 0 ? link.label.slice(0, dot) : link.label;
  const tail = dot > 0 ? link.label.slice(dot) : "";
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`brandmark brandmark--${link.platform}`}
    >
      <b>{head}</b>
      {tail && <span>{tail}</span>}
    </a>
  );
}

// Per-asset quick status flip. Updates the status here and — when the
// asset has its own listings — opens the first one in a new tab so the
// operator can flip it there too (the Georgian portals have no public
// third-party APIs). Personal-use assets get neither buttons nor links.
export default function ListingControls({
  assetId,
  status,
  links,
  showButtons,
  labels,
}: {
  assetId: string;
  status: string;
  links: ListingLink[];
  /** False while an active contract governs the status. */
  showButtons: boolean;
  labels: { rented: string; vacant: string };
}) {
  const [pending, startTransition] = useTransition();

  const flip = (next: "rented" | "vacant") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assetId", assetId);
      formData.set("status", next);
      await setAssetStatus(formData);
    });
    if (links[0]) window.open(links[0].url, "_blank", "noopener");
  };

  const linkChips = links.map((link) => <Brandmark key={link.platform} link={link} />);

  if (!showButtons) {
    return links.length > 0 ? (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">{linkChips}</div>
    ) : null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        disabled={pending || status === "rented"}
        onClick={() => flip("rented")}
        className={`btn-chip ${status === "rented" ? "btn-chip--active" : ""}`}
      >
        {labels.rented}
      </button>
      <button
        type="button"
        disabled={pending || status === "vacant"}
        onClick={() => flip("vacant")}
        className={`btn-chip ${status === "vacant" ? "btn-chip--active" : ""}`}
      >
        {labels.vacant}
      </button>
      {linkChips}
    </div>
  );
}
