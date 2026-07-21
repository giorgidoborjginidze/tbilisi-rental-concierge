"use client";

import { useMemo, useState } from "react";
import {
  CAR_MARKET,
  CAR_MODELS,
  DEFAULT_CAR_COSTS_PCT,
  DEFAULT_CAR_DAYS,
  compareToMarket,
  evaluateCar,
} from "@/lib/invest/car";

const fmt = (v: number) => `${Math.round(v).toLocaleString("en-US")} GEL`;

const CUSTOM = "__custom__";

export default function CarCalculator({
  labels,
}: {
  labels: Record<string, string>;
}) {
  const [model, setModel] = useState(CAR_MODELS[0]);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [days, setDays] = useState(DEFAULT_CAR_DAYS);
  const [costsPct, setCostsPct] = useState(DEFAULT_CAR_COSTS_PCT);

  const market = model === CUSTOM ? null : CAR_MARKET[model];
  const price = priceOverride ?? market?.avgPrice ?? 50_000;
  const dailyRate = rateOverride ?? market?.avgDailyRate ?? 150;

  const result = useMemo(
    () => evaluateCar({ price, dailyRate, daysPerMonth: days, costsPct }),
    [price, dailyRate, days, costsPct],
  );
  const comparison = market ? compareToMarket(price, market) : null;

  const comparisonBadge =
    comparison?.verdict === "below"
      ? "badge--rented"
      : comparison?.verdict === "above"
        ? "badge--danger"
        : "badge--listed";
  const comparisonLabel =
    comparison?.verdict === "below"
      ? labels.car_vs_market_below
      : comparison?.verdict === "above"
        ? labels.car_vs_market_above
        : labels.car_vs_market_at;

  const override =
    (setter: (v: number | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(event.target.value === "" ? null : Number(event.target.value) || 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="card form-grid form-grid--full" style={{ padding: 20, overflow: "visible" }}>
        <h2 className="col-span-2" style={{ margin: 0 }}>{labels.car_title}</h2>

        <label className="field col-span-2">
          {labels.car_model}
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPriceOverride(null);
              setRateOverride(null);
            }}
          >
            {CAR_MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value={CUSTOM}>{labels.car_custom}</option>
          </select>
        </label>

        <label className="field">
          {labels.car_price}
          <input type="number" min={0} value={price} onChange={override(setPriceOverride)} />
        </label>
        <label className="field">
          {labels.car_daily}
          <input type="number" min={0} value={dailyRate} onChange={override(setRateOverride)} />
        </label>

        <label className="field">
          {labels.car_days}
          <input
            type="number"
            min={0}
            max={31}
            value={days}
            onChange={(e) => setDays(Math.min(31, Number(e.target.value) || 0))}
          />
        </label>
        <label className="field">
          {labels.car_costs}
          <input
            type="number"
            min={0}
            max={100}
            value={costsPct}
            onChange={(e) => setCostsPct(Math.min(100, Number(e.target.value) || 0))}
          />
          <span className="hint">{labels.car_costs_hint}</span>
        </label>
      </div>

      <div className="grid gap-4">
        {market && comparison && (
          <div className="card" style={{ padding: 20 }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 style={{ margin: 0 }}>{labels.car_compare_title}</h2>
              <span className={`badge ${comparisonBadge}`}>
                {comparison.verdict === "at"
                  ? comparisonLabel
                  : `${Math.abs(comparison.deltaPct).toFixed(0)}% ${comparisonLabel}`}
              </span>
            </div>
            <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
              <div className="kpi">
                <div className="kpi__label">{labels.car_market_price}</div>
                <div className="kpi__value">{fmt(market.avgPrice)}</div>
                <div className="kpi__sub">{model}</div>
              </div>
              <div className="kpi">
                <div className="kpi__label">{labels.car_market_rate}</div>
                <div className="kpi__value">{fmt(market.avgDailyRate)}</div>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>{labels.car_market_hint}</p>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: 0 }}>{labels.inv_results}</h2>
          <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
            <div className="kpi">
              <div className="kpi__label">{labels.car_monthly_income}</div>
              <div className="kpi__value">{fmt(result.netMonthly)}</div>
              <div className="kpi__sub">
                {labels.car_gross}: {fmt(result.grossMonthly)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi__label">{labels.car_annual_yield}</div>
              <div className="kpi__value">{result.annualYieldPct.toFixed(1)}%</div>
            </div>
            <div className="kpi" style={{ gridColumn: "1 / -1" }}>
              <div className="kpi__label">{labels.res_payback}</div>
              <div className="kpi__value">
                {result.paybackYears == null
                  ? labels.res_never
                  : `${result.paybackYears.toFixed(1)} ${labels.res_years}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
