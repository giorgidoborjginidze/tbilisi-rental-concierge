"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addTrade, deleteTrade } from "@/lib/crypto/actions";
import type { FormState } from "@/lib/units/actions";
import { IconClose, IconTrendDown, IconTrendUp } from "@/app/icons";
import { formatMoney } from "@/lib/format";

export interface TradeRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  date: string;
}

// Buy / Sell entry: two buttons reveal a small inline form each; below,
// the list of trades with delete. Prices are USD per coin.
export default function CryptoTrades({
  assetId,
  symbol,
  trades,
  today,
  labels,
}: {
  assetId: string;
  symbol: string;
  trades: TradeRow[];
  today: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState<"buy" | "sell" | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addTrade,
    null,
  );

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { maximumFractionDigits: 8 });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={"btn-chip btn-chip--icon-text " + (open === "buy" ? "btn-chip--active" : "")}
          aria-pressed={open === "buy"}
          onClick={() => setOpen(open === "buy" ? null : "buy")}
        >
          <IconTrendUp size={15} /> {labels.crypto_buy}
        </button>
        <button
          type="button"
          className={"btn-chip btn-chip--icon-text " + (open === "sell" ? "btn-chip--active" : "")}
          aria-pressed={open === "sell"}
          onClick={() => setOpen(open === "sell" ? null : "sell")}
        >
          <IconTrendDown size={15} /> {labels.crypto_sell}
        </button>
      </div>

      {open && (
        <form
          action={formAction}
          className="alert-card"
          style={{ marginTop: 12, alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}
        >
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="side" value={open} />
          <div className="icon-text" style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            {open === "buy" ? <IconTrendUp size={16} /> : <IconTrendDown size={16} />}
            {open === "buy" ? labels.crypto_buy : labels.crypto_sell} · {symbol}
          </div>
          <label className="field" style={{ width: 150 }}>
            {labels.crypto_quantity}
            <input name="quantity" type="number" step="any" min="0" required />
          </label>
          <label className="field" style={{ width: 160 }}>
            {labels.crypto_unit_price}
            <input name="unitPrice" type="number" step="any" min="0" required />
          </label>
          <label className="field" style={{ width: 150 }}>
            {labels.contract_start}
            <input name="tradedAt" type="date" defaultValue={today} />
          </label>
          <button type="submit" disabled={pending} className="btn-primary">
            {labels.crypto_add_trade}
          </button>
          {state?.error && (
            <p style={{ color: "var(--status-danger-text)", fontSize: 13, width: "100%" }}>
              {labels[state.error] ?? state.error}
            </p>
          )}
        </form>
      )}

      {trades.length > 0 && (
        <div className="card card--stack" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>{labels.crypto_side}</th>
                <th className="num">{labels.crypto_quantity}</th>
                <th className="num">{labels.crypto_unit_price}</th>
                <th>{labels.contract_start}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td data-label={labels.crypto_side}>
                    {/* Buying or selling is neither good nor bad: a neutral tag
                        with a direction, not a traffic-light colour. */}
                    <span className="badge badge--tag badge--icon">
                      {t.side === "buy" ? <IconTrendUp size={14} /> : <IconTrendDown size={14} />}
                      {t.side === "buy" ? labels.crypto_buy : labels.crypto_sell}
                    </span>
                  </td>
                  <td className="num" data-label={labels.crypto_quantity}>{fmt(t.quantity)}</td>
                  <td className="num" data-label={labels.crypto_unit_price}>{formatMoney(t.unitPrice, "USD", 8)}</td>
                  <td data-label={labels.contract_start}>{t.date}</td>
                  <td className="num">
                    <form action={deleteTrade}>
                      <input type="hidden" name="tradeId" value={t.id} />
                      <input type="hidden" name="assetId" value={assetId} />
                      <button
                        type="submit"
                        className="btn-chip btn-chip--icon"
                        aria-label={labels.aria_delete_trade}
                        title={labels.aria_delete_trade}
                      >
                        <IconClose size={15} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
