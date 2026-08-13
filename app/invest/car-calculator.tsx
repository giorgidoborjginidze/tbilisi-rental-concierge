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
import { TAXI_DEFAULTS, evaluateTaxi } from "@/lib/invest/taxi";

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
  // Compared on cash per month, since that is what both produce.
  const diff = taxi.cashMonthly - result.netMonthly;
  const vsLabel =
    Math.abs(diff) < 50
      ? labels.taxi_vs_equal
      : diff > 0
        ? labels.taxi_vs_taxi_better
        : labels.taxi_vs_rental_better;
  const vsBadge =
    Math.abs(diff) < 50 ? "badge--listed" : diff > 0 ? "badge--rented" : "badge--vacant";

  const taxiNum =
    (setter: (v: number) => void, max = Infinity) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(Math.min(max, Number(event.target.value) || 0));

  const netColor = (v: number) =>
    v >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";

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
            <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
              <div className="kpi" style={{ "--i": 0 } as React.CSSProperties}>
                <div className="kpi__label">{labels.car_market_price}</div>
                <div className="kpi__value">{fmt(market.avgPrice)}</div>
                <div className="kpi__sub">{model}</div>
              </div>
              <div className="kpi" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="kpi__label">{labels.car_market_rate}</div>
                <div className="kpi__value">{fmt(market.avgDailyRate)}</div>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>{labels.car_market_hint}</p>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 style={{ margin: 0 }}>{labels.inv_results}</h2>
            {mode === "taxi" && (
              <span className={`badge ${vsBadge}`}>{vsLabel}</span>
            )}
          </div>

          {mode === "rental" ? (
            <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
              <div className="kpi" style={{ "--i": 0 } as React.CSSProperties}>
                <div className="kpi__label">{labels.car_monthly_income}</div>
                <div className="kpi__value">{fmt(result.netMonthly)}</div>
                <div className="kpi__sub">
                  {labels.car_gross}: {fmt(result.grossMonthly)}
                </div>
              </div>
              <div className="kpi" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="kpi__label">{labels.car_annual_yield}</div>
                <div className="kpi__value">{result.annualYieldPct.toFixed(1)}%</div>
              </div>
              <div className="kpi" style={{ gridColumn: "1 / -1", "--i": 2 } as React.CSSProperties}>
                <div className="kpi__label">{labels.res_payback}</div>
                <div className="kpi__value">
                  {result.paybackYears == null
                    ? labels.res_never
                    : `${result.paybackYears.toFixed(1)} ${labels.res_years}`}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="kpi-grid kpi-grid--3d" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
                <div className="kpi" style={{ "--i": 0 } as React.CSSProperties}>
                  <div className="kpi__label">{labels.taxi_res_cash}</div>
                  <div className="kpi__value" style={{ color: netColor(taxi.cashMonthly) }}>
                    {fmt(taxi.cashMonthly)}
                  </div>
                  <div className="kpi__sub">
                    {labels.taxi_res_gross}: {fmt(taxi.grossMonthly)}
                  </div>
                </div>
                <div className="kpi" style={{ "--i": 1 } as React.CSSProperties}>
                  <div className="kpi__label">{labels.taxi_res_net}</div>
                  <div className="kpi__value" style={{ color: netColor(taxi.netMonthly) }}>
                    {fmt(taxi.netMonthly)}
                  </div>
                  <div className="kpi__sub">{labels.taxi_res_net_hint}</div>
                </div>
                <div className="kpi" style={{ "--i": 2 } as React.CSSProperties}>
                  <div className="kpi__label">{labels.taxi_res_yield}</div>
                  <div className="kpi__value">{taxi.annualYieldPct.toFixed(1)}%</div>
                </div>
                <div className="kpi" style={{ "--i": 3 } as React.CSSProperties}>
                  <div className="kpi__label">{labels.taxi_res_payback}</div>
                  <div className="kpi__value">
                    {taxi.paybackYears == null
                      ? labels.res_never
                      : `${taxi.paybackYears.toFixed(1)} ${labels.res_years}`}
                  </div>
                </div>
                <div className="kpi" style={{ gridColumn: "1 / -1", "--i": 4 } as React.CSSProperties}>
                  <div className="kpi__label">{labels.taxi_res_costs}</div>
                  <div className="kpi__value">
                    {fmt(
                      taxi.platformFee + taxi.fuelMonthly +
                      taxi.runningMonthly + taxi.driverShare,
                    )}
                  </div>
                  <div className="kpi__sub">
                    {labels.taxi_c_platform}: {fmt(taxi.platformFee)} ·{" "}
                    {labels.taxi_c_fuel}: {fmt(taxi.fuelMonthly)} ·{" "}
                    {labels.taxi_c_running}: {fmt(taxi.runningMonthly)}
                    {taxi.driverShare > 0 && (
                      <> · {labels.taxi_c_driver}: {fmt(taxi.driverShare)}</>
                    )}
                  </div>
                </div>
              </div>

              {/* Rent it out or drive it? Compared on cash per month. */}
              <div className="alert-card" style={{ alignItems: "center", marginTop: 14 }}>
                <div>
                  <div className="alert-card__title">{labels.taxi_vs_rental}</div>
                  <div className="alert-card__detail">{labels.taxi_vs_hint}</div>
                </div>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {fmt(result.netMonthly)}
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
