"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createStock } from "@/lib/stocks/actions";
import type { FormState } from "@/lib/units/actions";

export default function StockForm({
  stocks,
  labels,
}: {
  stocks: { symbol: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStock,
    null,
  );
  const [symbol, setSymbol] = useState(stocks[0]?.symbol ?? "");
  const isCustom = symbol === "__custom__";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4" style={{ maxWidth: 460 }}>
      <label className="field">
        {labels.stock_ticker}
        <select name="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {stocks.map((s) => (
            <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
          ))}
          <option value="__custom__">{labels.crypto_custom}</option>
        </select>
      </label>

      {isCustom && (
        <>
          <label className="field">
            {labels.stock_custom_ticker}
            <input name="symbol" placeholder="e.g. ORCL" autoCapitalize="characters" required />
          </label>
          <label className="field">
            {labels.unit_name}
            <input name="name" placeholder="Oracle" />
          </label>
        </>
      )}

      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }}>
          {labels[state.error] ?? state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" style={{ alignSelf: "flex-start" }}>
        {labels.stock_add}
      </button>
      <p className="hint">{labels.stock_add_hint}</p>
    </form>
  );
}
