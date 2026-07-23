"use client";

import { useState } from "react";
import { detectPlatform, PLATFORMS } from "@/lib/listings";
import { Brandmark } from "./listing-controls";

// One smart field for listing links: paste a URL and the platform is
// detected automatically (myhome.ge, ss.ge, myauto.ge, Airbnb, Booking) and
// its logo shown. Multiple links are supported (one per platform). Hidden
// inputs mirror each detected URL into its Asset column so the existing
// saveAsset server action is unchanged.
export default function ListingInput({
  initial,
  labels,
}: {
  initial: string[];
  labels: Record<string, string>;
}) {
  const [rows, setRows] = useState<string[]>(initial.length ? initial : [""]);

  const update = (i: number, value: string) =>
    setRows((r) => r.map((row, j) => (j === i ? value : row)));
  const add = () => setRows((r) => [...r, ""]);
  const remove = (i: number) =>
    setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [""]));

  // Map each detected platform to its URL (last one wins per platform).
  const byField: Record<string, string> = {};
  for (const url of rows) {
    const def = detectPlatform(url);
    if (def && url.trim()) byField[def.field] = url.trim();
  }

  return (
    <div className="field sm:col-span-2">
      <span>{labels.listing_links}</span>
      <div className="flex flex-col gap-2">
        {rows.map((url, i) => {
          const def = detectPlatform(url);
          const trimmed = url.trim();
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => update(i, e.target.value)}
                style={{ flex: 1 }}
              />
              <div style={{ minWidth: 96, display: "flex", justifyContent: "flex-end" }}>
                {trimmed &&
                  (def ? (
                    <Brandmark link={{ platform: def.key, label: def.label, url: trimmed }} />
                  ) : (
                    <span className="hint" style={{ whiteSpace: "nowrap" }}>
                      {labels.listing_unknown}
                    </span>
                  ))}
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn-chip"
                  aria-label="remove link"
                  onClick={() => remove(i)}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-chip"
        style={{ alignSelf: "flex-start", marginTop: 4 }}
        onClick={add}
      >
        + {labels.listing_add}
      </button>
      <span className="hint">{labels.listing_hint}</span>

      {/* Mirror detected URLs into the Asset columns saveAsset reads. */}
      {PLATFORMS.map((p) => (
        <input key={p.field} type="hidden" name={p.field} value={byField[p.field] ?? ""} />
      ))}
    </div>
  );
}
