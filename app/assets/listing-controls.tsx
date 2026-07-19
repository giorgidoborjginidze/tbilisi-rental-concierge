"use client";

import { useTransition } from "react";
import { setAssetStatus } from "@/lib/assets/actions";

export interface ListingLink {
  label: string; // "myhome.ge" | "ss.ge" | "myauto.ge" | "Airbnb" | "Booking.com"
  url: string;
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

  const buttonClass = (active: boolean) =>
    `rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
      active
        ? "border-primary bg-primary text-white"
        : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
    }`;

  const linkChips = links.map((link) => (
    <a
      key={link.label}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-accent hover:underline"
    >
      {link.label} ↗
    </a>
  ));

  if (!showButtons) {
    return links.length > 0 ? (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">{linkChips}</div>
    ) : null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        disabled={pending || status === "rented"}
        onClick={() => flip("rented")}
        className={buttonClass(status === "rented")}
      >
        {labels.rented}
      </button>
      <button
        type="button"
        disabled={pending || status === "vacant"}
        onClick={() => flip("vacant")}
        className={buttonClass(status === "vacant")}
      >
        {labels.vacant}
      </button>
      {linkChips}
    </div>
  );
}
