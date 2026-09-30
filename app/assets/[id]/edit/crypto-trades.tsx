"use client";

import { useActionState, useState } from "react";
import { addTrade, deleteTrade } from "@/lib/crypto/actions";
import type { FormState } from "@/lib/units/actions";
import { IconClose, IconTrendDown, IconTrendUp } from "@/app/icons";
import { formatMoney, formatQuantity } from "@/lib/format";
import ConfirmAction from "@/app/confirm-action";
import { FormMessage, Req } from "@/app/form-bits";

export interface TradeRow {
  id: string;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  date: string;
}

// Buy / Sell entry: two buttons reveal a small inline form; below, the list
// of trades, each deleted only after a question in the page. Prices are
// USD per coin / share / troy ounce; a metal may be typed in grams. A saved
// trade folds the form and says so; an error keeps what was typed.
export default function CryptoTrades({
  assetId,
  symbol,
  trades,
  today,
  labels,
  metal = false,
  initialOpen = null,
}: {
  assetId: string;
  symbol: string;
  trades: TradeRow[];
  today: string;
  labels: Record<string, string>;
  metal?: boolean;
  /** A holding with no trade yet opens on its first purchase. */
  initialOpen?: "buy" | "sell" | null;
}) {
  const [open, setOpen] = useState<"buy" | "sell" | null>(initialOpen);
  const [unit, setUnit] = useState<"oz" | "g">("oz");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (previous, formData) => {
      const result = await addTrade(previous, formData);
      if (result?.ok) setOpen(null);
      return result;
    },
    null,
  );
  const sent = state && "values" in state ? state.values : undefined;

  const fmt = (v: number) => formatQuantity(v, metal ? "metal" : "coin");
  const quantityLabel = metal
    ? `${labels.crypto_quantity} (${unit === "g" ? labels.metal_unit_g : labels.metal_unit_oz})`
    : labels.crypto_quantity;
  const priceLabel = metal
    ? labels.crypto_unit_price.replace("{unit}", unit === "g" ? labels.metal_unit_g : labels.metal_unit_oz)
    : labels.crypto_unit_price;
  const toggle = (side: "buy" | "sell") => setOpen(open === side ? null : side);
  // The table shows what is stored: metals in troy ounces.
  const tableQuantity = metal ? `${labels.crypto_quantity} (${labels.metal_unit_oz})` : labels.crypto_quantity;
  const tablePrice = metal
    ? labels.crypto_unit_price.replace("{unit}", labels.metal_unit_oz)
    : labels.crypto_unit_price;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={"btn-chip btn-chip--icon-text " + (open === "buy" ? "btn-chip--active" : "")}
          aria-pressed={open === "buy"}
          onClick={() => toggle("buy")}
        >
          <IconTrendUp size={15} /> {labels.crypto_buy}
        </button>
        <button
          type="button"
          className={"btn-chip btn-chip--icon-text " + (open === "sell" ? "btn-chip--active" : "")}
          aria-pressed={open === "sell"}
          onClick={() => toggle("sell")}
        >
          <IconTrendDown size={15} /> {labels.crypto_sell}
        </button>
        {!open && <FormMessage saved={state?.ok ? labels.trade_saved : null} />}
      </div>

      {open && (
        <form action={formAction} className="card form-grid form-grid--full trade-form" style={{ marginTop: 12, padding: 16 }}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="side" value={open} />
          {metal && <input type="hidden" name="unit" value={unit} />}
          <div className="icon-text col-span-2" style={{ fontSize: 13.5, fontWeight: 600 }}>
            {open === "buy" ? <IconTrendUp size={16} /> : <IconTrendDown size={16} />}
            {open === "buy" ? labels.crypto_buy : labels.crypto_sell} · {symbol}
          </div>
          {metal && (
            <div className="col-span-2 unit-toggle" role="group" aria-label={labels.metal_unit_label}>
              {(["oz", "g"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`btn-chip${unit === key ? " btn-chip--active" : ""}`}
                  aria-pressed={unit === key}
                  onClick={() => setUnit(key)}
                >
                  {key === "g" ? labels.metal_unit_g : labels.metal_unit_oz}
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span>
              {quantityLabel}
              <Req />
            </span>
            <input
              name="quantity"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              aria-required="true"
              defaultValue={sent?.quantity}
            />
          </label>
          <label className="field">
            <span>
              {priceLabel}
              <Req />
            </span>
            <input
              name="unitPrice"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              required
              aria-required="true"
              defaultValue={sent?.unitPrice}
            />
          </label>
          <label className="field">
            {open === "buy" ? labels.trade_date_buy : labels.trade_date_sell}
            <input name="tradedAt" type="date" max={today} defaultValue={sent?.tradedAt ?? today} />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {labels.crypto_add_trade}
            </button>
            <FormMessage
              error={state?.error ? labels[state.error] ?? state.error : null}
              detail={state?.error ? state.detail : null}
            />
          </div>
        </form>
      )}

      {trades.length > 0 && (
        <div className="card card--stack" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>{labels.crypto_side}</th>
                <th className="num">{tableQuantity}</th>
                <th className="num">{tablePrice}</th>
                <th>{labels.trade_date}</th>
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
                  <td className="num" data-label={tableQuantity}>{fmt(t.quantity)}</td>
                  <td className="num" data-label={tablePrice}>{formatMoney(t.unitPrice, "USD", metal ? 2 : 8)}</td>
                  <td data-label={labels.trade_date}>{t.date}</td>
                  <td className="num">
                    <ConfirmAction
                      action={deleteTrade}
                      fields={{ tradeId: t.id, assetId }}
                      trigger={<IconClose size={15} />}
                      triggerClassName="btn-chip btn-chip--icon"
                      ariaLabel={labels.aria_delete_trade}
                      question={labels.trade_delete_q}
                      confirmLabel={labels.delete}
                      cancelLabel={labels.cancel}
                      inline
                    />
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
