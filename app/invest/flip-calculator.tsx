"use client";

import { useMemo, useState } from "react";
import { analyzeFlip } from "@/lib/invest/flip";
import { formatMoney } from "@/lib/format";
import { VERDICT_BADGE } from "@/lib/ui/tone";
import Kpi from "../kpi";

const fmt = (v: number) => formatMoney(v);
const pct = (v: number) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(1)}%`;

// The same three colours as every other calculator (lib/ui/tone.ts).

// Flip calculator: the profit is made once, so the number that matters is
// the annualized return — a 10% gain in three months is a different deal
// from the same 10% over three years.
export default function FlipCalculator({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const [price, setPrice] = useState(120_000);
  const [renovation, setRenovation] = useState(25_000);
  const [buyingCosts, setBuyingCosts] = useState(2_000);
  const [monthlyHoldingCost, setMonthlyHoldingCost] = useState(150);
  const [holdingMonths, setHoldingMonths] = useState(8);
  const [salePrice, setSalePrice] = useState(180_000);
  const [sellingFeePct, setSellingFeePct] = useState(2);
  const [taxPct, setTaxPct] = useState(5);

  const result = useMemo(
    () =>
      analyzeFlip({
        price,
        renovation,
        buyingCosts,
        monthlyHoldingCost,
        holdingMonths,
        salePrice,
        sellingFeePct,
        taxPct,
      }),
    [
      price, renovation, buyingCosts, monthlyHoldingCost,
      holdingMonths, salePrice, sellingFeePct, taxPct,
    ],
  );

  const num =
    (setter: (v: number) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(Number(event.target.value) || 0);

  const profitColor =
    result.netProfit >= 0
      ? "var(--status-rented-text)"
      : "var(--status-danger-text)";

  return (
    <div>
      <p
        className="mb-4"
        style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}
      >
        {labels.flip_intro}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div
          className="card form-grid form-grid--full"
          style={{ padding: 20, overflow: "visible" }}
        >
          <h2 className="col-span-2" style={{ margin: 0 }}>{labels.flip_title}</h2>

          <label className="field">
            {labels.flip_price}
            <input type="number" min={0} value={price} onChange={num(setPrice)} />
          </label>
          <label className="field">
            {labels.flip_renovation}
            <input type="number" min={0} value={renovation} onChange={num(setRenovation)} />
          </label>

          <label className="field">
            {labels.flip_buying_costs}
            <input type="number" min={0} value={buyingCosts} onChange={num(setBuyingCosts)} />
          </label>
          <label className="field">
            {labels.flip_months}
            <input
              type="number"
              min={1}
              max={120}
              value={holdingMonths}
              onChange={num(setHoldingMonths)}
            />
          </label>

          <label className="field col-span-2">
            {labels.flip_holding_cost}
            <input
              type="number"
              min={0}
              value={monthlyHoldingCost}
              onChange={num(setMonthlyHoldingCost)}
            />
            <span className="hint">{labels.flip_holding_cost_hint}</span>
          </label>

          <label className="field col-span-2">
            {labels.flip_sale_price}
            <input type="number" min={0} value={salePrice} onChange={num(setSalePrice)} />
          </label>

          <label className="field">
            {labels.flip_selling_fee}
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={sellingFeePct}
              onChange={num(setSellingFeePct)}
            />
          </label>
          <label className="field">
            {labels.flip_tax}
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxPct}
              onChange={num(setTaxPct)}
            />
          </label>
        </div>

        <div>
          {/* The verdict says what it measured: the yearly rate, against a
              bank deposit — not "about a deposit" for 15% a year. */}
          <div className="alert-card" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <div className="alert-card__title">{labels.inv_results}</div>
            <span className={VERDICT_BADGE[result.verdict]}>
              {labels[`flip_verdict_${result.verdict}`].replace("{x}", pct(result.annualizedPct))}
            </span>
            <div className="alert-card__detail" style={{ flexBasis: "100%" }}>
              {labels.flip_verdict_basis
                .replace("{strong}", pct(result.thresholds.strongPct))
                .replace("{rate}", pct(result.thresholds.depositPct))}
            </div>
          </div>

          <div
            className="kpi-grid kpi-grid--3d"
            style={{ margin: "14px 0", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            <Kpi
              index={0}
              label={labels.flip_res_invested}
              value={fmt(result.totalInvested)}
              sub={`${labels.flip_res_holding}: ${fmt(result.holdingCosts)}`}
            />

            <Kpi
              index={1}
              label={labels.flip_res_profit}
              value={fmt(result.netProfit)}
              valueStyle={{ color: profitColor }}
              sub={`${labels.flip_res_tax}: ${fmt(result.tax)}`}
            />

            <Kpi
              index={2}
              label={labels.flip_res_annual}
              value={pct(result.annualizedPct)}
              valueStyle={{ color: profitColor }}
              sub={`${labels.flip_res_roi}: ${pct(result.roiPct)}`}
            />

            <Kpi
              index={3}
              label={labels.flip_res_per_month}
              value={fmt(result.profitPerMonth)}
              valueStyle={{ color: profitColor }}
            />

            <Kpi
              index={4}
              style={{ gridColumn: "1 / -1" }}
              label={labels.flip_res_breakeven}
              value={fmt(result.breakEvenPrice)}
              sub={`${labels.flip_res_breakeven_hint} · ${labels.flip_res_net_proceeds}: ${fmt(result.netSaleProceeds)} (${labels.flip_res_selling_fee}: ${fmt(result.sellingFee)})`}
            />
          </div>

          <p className="demo-hint" style={{ marginTop: 0 }}>
            {labels.invest_disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
