"use client";

import { useTransition } from "react";
import { setAssetStatus } from "@/lib/assets/actions";

export interface ListingLink {
  /** Platform key — maps to a .brandmark--* variant. */
  platform: string; // "myhome" | "ss" | "myauto" | "airbnb" | "booking"
  label: string; // "myhome.ge" | "ss.ge" | "myauto.ge" | "Airbnb" | "Booking.com"
  url: string;
}

// ss.ge stripes glyph (the logo's staggered rainbow bars).
const SS_STRIPES = [
  { w: 8, c: "#f43535" },
  { w: 6, c: "#ff8a00" },
  { w: 8, c: "#ffc400" },
  { w: 6, c: "#3fbf2f" },
  { w: 8, c: "#1e88ff" },
  { w: 6, c: "#9b30f2" },
];

// Airbnb bélo, simplified for 12px rendering.
const BELO_PATH =
  "M12 2.6c1.1 0 2 .6 2.6 1.7l5.5 11.1c1 2-.4 4.2-2.6 4.2-1 0-2-.5-3-1.4L12 16l-2.5 2.2c-1 .9-2 1.4-3 1.4-2.2 0-3.6-2.2-2.6-4.2L9.4 4.3C10 3.2 10.9 2.6 12 2.6Zm0 4.2c-.9 0-1.7.8-1.7 1.8 0 .6.3 1.4.9 2.4l.8 1.3.8-1.3c.6-1 .9-1.8.9-2.4 0-1-.8-1.8-1.7-1.8Z";

// Branded platform chip. myhome/myauto keep the approved design's
// two-tone pill; ss/airbnb/booking mimic each portal's real logo.
export function Brandmark({ link }: { link: ListingLink }) {
  const shared = {
    href: link.url,
    target: "_blank",
    rel: "noopener noreferrer",
  } as const;

  if (link.platform === "ss") {
    return (
      <a {...shared} className="brandmark brandmark--ss">
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          {SS_STRIPES.map((bar, i) => (
            <rect key={i} x={0} y={i * 2} width={bar.w} height={1.4} rx={0.7} fill={bar.c} />
          ))}
        </svg>
        <span>ss.ge</span>
      </a>
    );
  }
  if (link.platform === "airbnb") {
    return (
      <a {...shared} className="brandmark brandmark--airbnb">
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
          <path d={BELO_PATH} fill="#ff385c" fillRule="evenodd" />
        </svg>
        <span>airbnb</span>
      </a>
    );
  }
  if (link.platform === "booking") {
    return (
      <a {...shared} className="brandmark brandmark--booking">
        <span>Booking.com</span>
      </a>
    );
  }

  const dot = link.label.indexOf(".");
  const head = dot > 0 ? link.label.slice(0, dot) : link.label;
  const tail = dot > 0 ? link.label.slice(dot) : "";
  return (
    <a {...shared} className={`brandmark brandmark--${link.platform}`}>
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
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{linkChips}</div>
    ) : null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
