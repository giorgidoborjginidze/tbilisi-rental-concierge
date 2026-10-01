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
import { TAXI_DEFAULTS, TAXI_GOOD_PCT, TAXI_OK_PCT, evaluateTaxi, taxiVsRental } from "@/lib/invest/taxi";
import { formatMoneyInline } from "@/lib/format";
import { TONE_BADGE, VERDICT_BADGE } from "@/lib/ui/tone";
import Kpi from "../kpi";

const fmt = (v: number) => formatMoneyInline(v);

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

  // Taxi mode: same car, a different business.
  const [mode, setMode] = useState<"rental" | "taxi">("rental");
  const [grossPerDay, setGrossPerDay] = useState<number>(TAXI_DEFAULTS.grossPerDay);
  const [taxiDays, setTaxiDays] = useState<number>(TAXI_DEFAULTS.daysPerMonth);
  const [platformPct, setPlatformPct] = useState<number>(TAXI_DEFAULTS.platformPct);
  const [fuelPerDay, setFuelPerDay] = useState<number>(TAXI_DEFAULTS.fuelPerDay);
  const [servicePerMonth, setServicePerMonth] = useState<number>(TAXI_DEFAULTS.servicePerMonth);
  const [insurancePerYear, setInsurancePerYear] = useState<number>(TAXI_DEFAULTS.insurancePerYear);
  const [depreciationPct, setDepreciationPct] = useState<number>(TAXI_DEFAULTS.depreciationPct);
  const [driverSharePct, setDriverSharePct] = useState<number>(TAXI_DEFAULTS.driverSharePct);

  const market = model === CUSTOM ? null : CAR_MARKET[model];
  const price = priceOverride ?? market?.avgPrice ?? 50_000;
  const dailyRate = rateOverride ?? market?.avgDailyRate ?? 150;

  const result = useMemo(
    () => evaluateCar({ price, dailyRate, daysPerMonth: days, costsPct }),
    [price, dailyRate, days, costsPct],
  );
  const comparison = market ? compareToMarket(price, market) : null;

  const taxi = useMemo(
    () =>
      evaluateTaxi({
        price, grossPerDay, daysPerMonth: taxiDays, platformPct, fuelPerDay,
        servicePerMonth, insurancePerYear, depreciationPct, driverSharePct,
      }),
    [
      price, grossPerDay, taxiDays, platformPct, fuelPerDay,
      servicePerMonth, insurancePerYear, depreciationPct, driverSharePct,
    ],
  );

  // The question an owner here actually has: rent it out, or drive it?
  // Like for like: both after the car's lost value (the rental's running
  // costs already include amortisation).
  const vs = taxiVsRental(taxi.netMonthly, result.netMonthly);
  const vsLabel =
    vs.winner === "equal"
      ? labels.taxi_vs_equal
      : vs.winner === "taxi"
        ? labels.taxi_vs_taxi_better
        : labels.taxi_vs_rental_better;
  // Which earns more is advice, not a warning: blue either way, grey when even.
  const vsBadge = vs.winner === "equal" ? TONE_BADGE.muted : TONE_BADGE.info;

  const taxiNum =
    (setter: (v: number) => void, max = Infinity) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(Math.min(max, Number(event.target.value) || 0));

  const netColor = (v: number) =>
    v >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";

  // Buying below the market is good, above it worth a second look.
  const comparisonBadge =
    comparison?.verdict === "below"
      ? TONE_BADGE.good
      : comparison?.verdict === "above"
        ? TONE_BADGE.warn
        : TONE_BADGE.muted;
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
    <div>
      <p className="mb-4" style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 640 }}>
        {mode === "taxi" ? labels.taxi_intro : labels.car_intro}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="card form-grid form-grid--full" style={{ padding: 20, overflow: "visible" }}>
        <h2 className="col-span-2" style={{ margin: 0 }}>
          {mode === "taxi" ? labels.taxi_title : labels.car_title}
        </h2>

        <div className="col-span-2 flex flex-wrap gap-1.5">
          {(["rental", "taxi"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={"btn-chip " + (mode === m ? "btn-chip--active" : "")}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m === "taxi" ? labels.car_mode_taxi : labels.car_mode_rental}
            </button>
          ))}
        </div>

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

        {mode === "rental" ? (
          <>
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
          </>
        ) : (
          <>
            <label className="field">
              {labels.taxi_gross_day}
              <input type="number" min={0} value={grossPerDay} onChange={taxiNum(setGrossPerDay)} />
            </label>
            <label className="field">
              {labels.taxi_days}
              <input type="number" min={0} max={31} value={taxiDays} onChange={taxiNum(setTaxiDays, 31)} />
            </label>

            <label className="field">
              {labels.taxi_fuel_day}
              <input type="number" min={0} value={fuelPerDay} onChange={taxiNum(setFuelPerDay)} />
            </label>
            <label className="field">
              {labels.taxi_platform}
              <input type="number" min={0} max={100} value={platformPct} onChange={taxiNum(setPlatformPct, 100)} />
              <span className="hint">{labels.taxi_platform_hint}</span>
            </label>

            <label className="field">
              {labels.taxi_service}
              <input type="number" min={0} value={servicePerMonth} onChange={taxiNum(setServicePerMonth)} />
            </label>
            <label className="field">
              {labels.taxi_insurance}
              <input type="number" min={0} value={insurancePerYear} onChange={taxiNum(setInsurancePerYear)} />
            </label>

            <label className="field">
              {labels.taxi_depreciation}
              <input type="number" min={0} max={100} value={depreciationPct} onChange={taxiNum(setDepreciationPct, 100)} />
              <span className="hint">{labels.taxi_depreciation_hint}</span>
            </label>
            <label className="field">
              {labels.taxi_driver_share}
              <input type="number" min={0} max={100} value={driverSharePct} onChange={taxiNum(setDriverSharePct, 100)} />
              <span className="hint">{labels.taxi_driver_share_hint}</span>
            </label>
          </>
        )}
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
            {/* margin, not marginTop: the grid's own 36px bottom margin left a
                gap before the note and an empty band at the card's foot. */}
            <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "14px 0 0" }}>
              <Kpi index={0} label={labels.car_market_price} value={fmt(market.avgPrice)} sub={model} />
              <Kpi index={1} label={labels.car_market_rate} value={fmt(market.avgDailyRate)} />
            </div>
            <p className="hint" style={{ marginTop: 10 }}>{labels.car_market_hint}</p>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 style={{ margin: 0 }}>{labels.inv_results}</h2>
            {/* The taxi's own verdict: is it worth the hours? */}
            {mode === "taxi" && (
              <span className={VERDICT_BADGE[taxi.verdict]}>{labels[`taxi_verdict_${taxi.verdict}`]}</span>
            )}
          </div>
          {mode === "taxi" && (
            <p className="hint" style={{ margin: "8px 0 0" }}>
              {labels.taxi_verdict_basis
                .replace("{good}", `${TAXI_GOOD_PCT}%`)
                .replace("{ok}", `${TAXI_OK_PCT}%`)}
            </p>
          )}

          {mode === "rental" ? (
            <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "14px 0 0" }}>
              <Kpi
                index={0}
                label={labels.car_monthly_income}
                value={fmt(result.netMonthly)}
                sub={`${labels.car_gross}: ${fmt(result.grossMonthly)}`}
              />
              <Kpi index={1} label={labels.car_annual_yield} value={`${result.annualYieldPct.toFixed(1)}%`} />
              <Kpi
                index={2}
                style={{ gridColumn: "1 / -1" }}
                label={labels.res_payback}
                value={
                  result.paybackYears == null
                    ? labels.res_never
                    : `${result.paybackYears.toFixed(1)} ${labels.res_years}`
                }
              />
            </div>
          ) : (
            <>
              <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: "14px 0 0" }}>
                <Kpi
                  index={0}
                  label={labels.taxi_res_cash}
                  value={fmt(taxi.cashMonthly)}
                  valueStyle={{ color: netColor(taxi.cashMonthly) }}
                  sub={`${labels.taxi_res_gross}: ${fmt(taxi.grossMonthly)}`}
                />
                <Kpi
                  index={1}
                  label={labels.taxi_res_net}
                  value={fmt(taxi.netMonthly)}
                  valueStyle={{ color: netColor(taxi.netMonthly) }}
                  sub={labels.taxi_res_net_hint}
                />
                <Kpi
                  index={2}
                  label={labels.taxi_res_yield}
                  value={`${taxi.annualYieldPct.toFixed(1)}%`}
                  sub={labels.taxi_res_yield_hint}
                />
                <Kpi
                  index={3}
                  label={labels.taxi_res_payback}
                  value={
                    taxi.paybackYears == null
                      ? labels.res_never
                      : `${taxi.paybackYears.toFixed(1)} ${labels.res_years}`
                  }
                />
                <Kpi
                  index={4}
                  style={{ gridColumn: "1 / -1" }}
                  label={labels.taxi_res_costs}
                  value={fmt(taxi.platformFee + taxi.fuelMonthly + taxi.runningMonthly + taxi.driverShare)}
                  sub={
                    <>
                      {labels.taxi_c_platform}: {fmt(taxi.platformFee)} · {labels.taxi_c_fuel}: {fmt(taxi.fuelMonthly)} ·{" "}
                      {labels.taxi_c_running}: {fmt(taxi.runningMonthly)}
                      {taxi.driverShare > 0 && (
                        <> · {labels.taxi_c_driver}: {fmt(taxi.driverShare)}</>
                      )}
                    </>
                  }
                />
              </div>

              {/* Rent it out or drive it? Both after the car's lost value. */}
              <div className="alert-card" style={{ alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div className="alert-card__title">{labels.taxi_vs_rental}</div>
                  <div className="alert-card__detail">{labels.taxi_vs_hint}</div>
                </div>
                <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(result.netMonthly)}</span>
                  <span className={`badge ${vsBadge}`}>{vsLabel}</span>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
