"use client";

import { useMemo, useState } from "react";
import { analyzeInvestment } from "@/lib/invest/calc";
import {
  DEFAULT_DEPOSIT_RATE,
  DEFAULT_INCOME_TAX,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_VACANCY,
  RENOVATION_LEVELS,
  RENOVATION_PER_SQM,
  type RenovationLevel,
} from "@/lib/invest/market";

const fmt = (v: number) => `${Math.round(v).toLocaleString("en-US")} GEL`;
const pct = (v: number) => `${v.toFixed(1)}%`;

const VERDICT_BADGE = {
  good: "badge--rented",
  ok: "badge--vacant",
  poor: "badge--danger",
} as const;

export default function Calculator({
  districts,
  rentPerSqm,
  pricePerSqm,
  labels,
}: {
  districts: string[];
  /** District → avg long-term rent, GEL per m² (mock benchmark). */
  rentPerSqm: Record<string, number>;
  /** District → avg purchase price, GEL per m² (mock). */
  pricePerSqm: Record<string, number>;
  labels: Record<string, string>;
}) {
  const [district, setDistrict] = useState(districts[0] ?? "");
  const [area, setArea] = useState(60);
  const [renovation, setRenovation] = useState<RenovationLevel>("cosmetic");
  // Manual overrides; null = follow the district/area prefill.
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [renovOverride, setRenovOverride] = useState<number | null>(null);
  const [rentOverride, setRentOverride] = useState<number | null>(null);
  const [vacancy, setVacancy] = useState(DEFAULT_VACANCY);
  const [tax, setTax] = useState(DEFAULT_INCOME_TAX);
  const [useLoan, setUseLoan] = useState(true);
  const [downPayment, setDownPayment] = useState(20);
  const [rate, setRate] = useState(DEFAULT_MORTGAGE_RATE);
  const [term, setTerm] = useState(10);
  const [depositRate, setDepositRate] = useState(DEFAULT_DEPOSIT_RATE);

  const price =
    priceOverride ?? Math.round(area * (pricePerSqm[district] ?? 3500));
  const renovCost =
    renovOverride ?? Math.round(area * RENOVATION_PER_SQM[renovation]);
  const rent = rentOverride ?? Math.round(area * (rentPerSqm[district] ?? 28));

  const result = useMemo(
    () =>
      analyzeInvestment({
        price,
        renovation: renovCost,
        monthlyRent: rent,
        vacancyPct: vacancy,
        incomeTaxPct: tax,
        useLoan,
        downPaymentPct: downPayment,
        annualRatePct: rate,
        termYears: term,
        depositRatePct: depositRate,
      }),
    [price, renovCost, rent, vacancy, tax, useLoan, downPayment, rate, term, depositRate],
  );

  const years = (v: number | null) =>
    v == null ? labels.res_never : `${v.toFixed(1)} ${labels.res_years}`;

  const num =
    (setter: (v: number) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(Number(event.target.value) || 0);
  const override =
    (setter: (v: number | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setter(event.target.value === "" ? null : Number(event.target.value) || 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="card form-grid form-grid--full" style={{ padding: 20, overflow: "visible" }}>
        <h2 className="col-span-2" style={{ margin: 0 }}>{labels.inv_params}</h2>

        <label className="field">
          {labels.inv_district}
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {labels.inv_area}
          <input type="number" min={5} value={area} onChange={num(setArea)} />
        </label>

        <label className="field">
          {labels.inv_price}
          <input type="number" min={0} value={price} onChange={override(setPriceOverride)} />
          <span className="hint">{labels.inv_price_hint}</span>
        </label>
        <label className="field">
          {labels.inv_rent}
          <input type="number" min={0} value={rent} onChange={override(setRentOverride)} />
          <span className="hint">{labels.inv_rent_hint}</span>
        </label>

        <label className="field">
          {labels.inv_renovation}
          <select
            value={renovation}
            onChange={(e) => {
              setRenovation(e.target.value as RenovationLevel);
              setRenovOverride(null);
            }}
          >
            {RENOVATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {labels[`renov_${level}`]} (~{RENOVATION_PER_SQM[level]} GEL/m²)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {labels.inv_renov_cost}
          <input type="number" min={0} value={renovCost} onChange={override(setRenovOverride)} />
        </label>

        <label className="field">
          {labels.inv_vacancy}
          <input type="number" min={0} max={100} value={vacancy} onChange={num(setVacancy)} />
        </label>
        <label className="field">
          {labels.inv_tax}
          <input type="number" min={0} max={100} value={tax} onChange={num(setTax)} />
        </label>

        <h2 className="col-span-2" style={{ margin: "8px 0 0" }}>{labels.inv_financing}</h2>

        <label
          className="field col-span-2"
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <input
            type="checkbox"
            checked={useLoan}
            onChange={(e) => setUseLoan(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          {labels.inv_use_loan}
        </label>

        {useLoan && (
          <>
            <label className="field">
              {labels.inv_down_payment}
              <input type="number" min={0} max={100} value={downPayment} onChange={num(setDownPayment)} />
            </label>
            <label className="field">
              {labels.inv_rate}
              <input type="number" min={0} step={0.1} value={rate} onChange={num(setRate)} />
            </label>
            <label className="field">
              {labels.inv_term_years}
              <input type="number" min={1} max={30} value={term} onChange={num(setTerm)} />
            </label>
          </>
        )}
        <label className="field">
          {labels.inv_deposit_rate}
          <input type="number" min={0} step={0.1} value={depositRate} onChange={num(setDepositRate)} />
        </label>
      </div>

      <div>
        <div className="alert-card" style={{ alignItems: "center" }}>
          <div className="alert-card__title">{labels.inv_results}</div>
          <span className={`badge ${VERDICT_BADGE[result.verdict]}`}>
            {labels[`res_verdict_${result.verdict}`]}
          </span>
        </div>

        <div className="kpi-grid" style={{ margin: "14px 0", gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="kpi">
            <div className="kpi__label">{labels.res_total_investment}</div>
            <div className="kpi__value">{fmt(result.totalInvestment)}</div>
            {useLoan && (
              <div className="kpi__sub">
                {labels.res_cash_invested}: {fmt(result.cashInvested)}
              </div>
            )}
          </div>
          <div className="kpi">
            <div className="kpi__label">{labels.res_net_income}</div>
            <div className="kpi__value">{fmt(result.netMonthlyIncome)}</div>
            <div className="kpi__sub">
              {labels.res_deposit_income}: {fmt(result.depositMonthlyIncome)}
            </div>
          </div>
          {useLoan && (
            <div className="kpi">
              <div className="kpi__label">{labels.res_monthly_payment}</div>
              <div className="kpi__value">{fmt(result.monthlyPayment)}</div>
              <div className="kpi__sub">
                {labels.res_total_loan_cost}: {fmt(result.totalLoanCost)}
              </div>
            </div>
          )}
          {useLoan && (
            <div className="kpi">
              <div className="kpi__label">{labels.res_cash_flow}</div>
              <div
                className="kpi__value"
                style={{
                  color:
                    result.monthlyCashFlow >= 0
                      ? "var(--status-rented-text)"
                      : "var(--status-danger-text)",
                }}
              >
                {fmt(result.monthlyCashFlow)}
              </div>
              <div className="kpi__sub">
                {labels.res_cash_payback}: {years(result.cashPaybackYears)}
              </div>
            </div>
          )}
          <div className="kpi">
            <div className="kpi__label">{labels.res_net_yield}</div>
            <div className="kpi__value">{pct(result.netYieldPct)}</div>
            <div className="kpi__sub">
              {labels.res_gross_yield}: {pct(result.grossYieldPct)}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{labels.res_payback}</div>
            <div className="kpi__value">{years(result.paybackYears)}</div>
          </div>
        </div>

        <p className="demo-hint" style={{ marginTop: 0 }}>{labels.invest_disclaimer}</p>
      </div>
    </div>
  );
}
