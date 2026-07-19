"use client";

import { useTransition } from "react";
import { generateDoorCode } from "@/lib/assets/actions";

// Digital door key for an asset: shows the current code, generates a
// fresh one, and opens WhatsApp with a prefilled message (deep link —
// works without the WhatsApp Business API).
export default function DoorKey({
  assetId,
  code,
  message,
  phone,
  labels,
}: {
  assetId: string;
  code: string | null;
  /** Prefilled WhatsApp message (already localized, without the code). */
  message: string;
  /** Tenant phone in international digits, e.g. "995599123456". */
  phone: string | null;
  labels: { key: string; generate: string };
}) {
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assetId", assetId);
      await generateDoorCode(formData);
    });
  };

  const text = encodeURIComponent(`${message} ${code ?? ""}`.trim());
  const waHref = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-neutral-500">🔑 {labels.key}:</span>
      {code ? (
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono font-semibold tracking-wider dark:bg-neutral-800">
          {code}
        </span>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="rounded border border-neutral-300 px-2 py-0.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        {labels.generate}
      </button>
      {code && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          WhatsApp ↗
        </a>
      )}
    </div>
  );
}
