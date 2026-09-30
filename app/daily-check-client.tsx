"use client";

import { useActionState, useState } from "react";
import { saveDayEntry } from "@/lib/rentals/actions";
import { IconCheck, IconClose } from "./icons";
import { formatMoney } from "@/lib/format";
import type { FormState } from "@/lib/units/actions";

export interface DayAsset {
  id: string;
  name: string;
  place: string;
  /** ISO date (YYYY-MM-DD) this row is asking about. */
  date: string;
  /** The tariff for that day — base rate plus any weekend/holiday premium. */
  suggested: number;
  currency: string;
  kind: "holiday" | "weekend" | "base";
  /** The answer already on record, if the day has been filled in. */
  answered: { rented: boolean; amount: number } | null;
  /**
   * A booking, lease or contract already holds today: that stay is the
   * record of the night, so the question is not asked (one source per
   * night — lib/property/stays.ts). `amount` is the night's price if known.
   */
  covered: { label: string; amount: number | null } | null;
}

// One row per daily-let asset, asking the only question that matters each
// morning: was it rented today, and for how much. The tariff is a
// suggestion in the box — whatever was agreed is what gets saved, and it
// stays editable afterwards.
export default function DailyCheckClient({
  assets,
  labels,
}: {
  assets: DayAsset[];
  labels: Record<string, string>;
}) {
  return (
    <div className="daily-zone">
      {assets.map((asset) => (
        <Row key={asset.id} asset={asset} labels={labels} />
      ))}
    </div>
  );
}

function Row({
  asset,
  labels,
}: {
  asset: DayAsset;
  labels: Record<string, string>;
}) {
  const [state, save, saving] = useActionState<FormState, FormData>(
    saveDayEntry,
    null,
  );
  // An answered day collapses to a summary until the owner asks to change
  // it. The open/closed state follows the record unless the owner has
  // deliberately opened the row — a plain useState would freeze on the
  // value it was first given and never notice the answer arriving.
  const [override, setOverride] = useState<boolean | null>(null);
  const editing = override ?? asset.answered == null;
  const [amount, setAmount] = useState(
    String(asset.answered?.rented ? asset.answered.amount : asset.suggested),
  );

  // A saved answer hands control back to the record (adjusted while
  // rendering, when a new action result arrives — no effect needed).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setOverride(null);
  }

  const kindLabel =
    asset.kind === "holiday"
      ? labels.day_holiday
      : asset.kind === "weekend"
        ? labels.day_weekend
        : labels.day_base;

  if (asset.covered) {
    return (
      <div className="daily-row daily-row--done">
        <span className="daily-row__ico" data-on="1">
          <IconCheck size={17} />
        </span>
        <span className="daily-row__txt">
          <b>{asset.name}</b>
          <span>{asset.place}</span>
        </span>
        <span className="daily-row__sum">
          {asset.covered.amount != null ? formatMoney(asset.covered.amount, asset.currency) : labels.day_yes}
        </span>
        <span className="daily-row__src">{asset.covered.label}</span>
      </div>
    );
  }

  if (!editing && asset.answered) {
    return (
      <div className="daily-row daily-row--done">
        <span className="daily-row__ico" data-on={asset.answered.rented ? "1" : "0"}>
          {asset.answered.rented ? <IconCheck size={17} /> : <IconClose size={15} />}
        </span>
        <span className="daily-row__txt">
          <b>{asset.name}</b>
          <span>{asset.place}</span>
        </span>
        <span className="daily-row__sum">
          {asset.answered.rented
            ? formatMoney(asset.answered.amount, asset.currency)
            : labels.day_no}
        </span>
        <button type="button" className="btn-chip" onClick={() => setOverride(true)}>
          {labels.day_edit}
        </button>
      </div>
    );
  }

  return (
    <form action={save} className="daily-row">
      <input type="hidden" name="assetId" value={asset.id} />
      <input type="hidden" name="date" value={asset.date} />

      <span className="daily-row__txt">
        <b>{asset.name}</b>
        <span>
          {asset.place}
          {asset.kind !== "base" && (
            <em className={`daily-tag daily-tag--${asset.kind}`}>{kindLabel}</em>
          )}
        </span>
      </span>

      <label className="daily-row__amount">
        <span>{labels.day_amount}</span>
        <input
          name="amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
        />
      </label>

      <span className="daily-row__actions">
        <button
          type="submit"
          name="rented"
          value="1"
          className="btn-primary"
          disabled={saving}
        >
          {labels.day_yes}
        </button>
        <button
          type="submit"
          name="rented"
          value="0"
          className="btn-secondary"
          disabled={saving}
        >
          {labels.day_no}
        </button>
      </span>

      {state?.error && <p className="form-error daily-row__err">{labels[state.error]}</p>}
    </form>
  );
}
