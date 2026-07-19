"use client";

import { useTransition } from "react";
import { setAssetStatus } from "@/lib/assets/actions";

// Per-asset quick status flip. Updates the status here and — when the
// asset has its own myhome.ge listing — opens that exact listing in a new
// tab so the operator can flip it there too (myhome.ge has no public API
// for third-party status updates).
export default function ListingControls({
  assetId,
  status,
  myhomeUrl,
  showButtons,
  labels,
}: {
  assetId: string;
  status: string;
  myhomeUrl: string | null;
  /** False while an active contract governs the status. */
  showButtons: boolean;
  labels: { rented: string; vacant: string; open: string };
}) {
  const [pending, startTransition] = useTransition();

  const flip = (next: "rented" | "vacant") => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assetId", assetId);
      formData.set("status", next);
      await setAssetStatus(formData);
    });
    if (myhomeUrl) window.open(myhomeUrl, "_blank", "noopener");
  };

  const buttonClass = (active: boolean) =>
    `rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
      active
        ? "border-neutral-800 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
        : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
    }`;

  if (!showButtons) {
    return myhomeUrl ? (
      <div className="mt-1.5">
        <a
          href={myhomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={labels.open}
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          myhome ↗
        </a>
      </div>
    ) : null;
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
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
      {myhomeUrl && (
        <a
          href={myhomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={labels.open}
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          myhome ↗
        </a>
      )}
    </div>
  );
}
