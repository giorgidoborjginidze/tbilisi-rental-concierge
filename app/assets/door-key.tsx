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
    <div
      className="flex flex-wrap items-center gap-1.5"
      style={{ fontSize: 12 }}
      title={labels.key}
    >
      <span style={{ color: "var(--color-text-muted)" }}>🔑</span>
      {code ? (
        <span
          className="font-mono"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "1px 7px",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          {code}
        </span>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>—</span>
      )}
      <button type="button" onClick={generate} disabled={pending} className="btn-chip">
        {labels.generate}
      </button>
      {code && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-chip btn-chip--wa"
        >
          WhatsApp ↗
        </a>
      )}
    </div>
  );
}
