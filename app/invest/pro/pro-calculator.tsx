"use client";

import { useMemo, useState } from "react";
import {
  analyzeWorthiness,
  switchWorthinessCurrency,
  WORTHINESS_DEFAULTS_GEL,
  type WorthinessCurrency,
  type WorthinessInputs,
} from "@/lib/invest/worthiness";
import { currencySign, formatMoney } from "@/lib/format";
import { VERDICT_BADGE } from "@/lib/ui/tone";

export default function ProCalculator({
  labels,
}: {
  labels: Record<string, string>;
}) {
  // Lari first, like the free calculator; dollars stay one click away.
  const [inputs, setInputs] = useState<WorthinessInputs>(WORTHINESS_DEFAULTS_GEL);
  const [currency, setCurrency] = useState<WorthinessCurrency>("GEL");
  // The owner's own figures were kept through a currency switch.
  const [notConverted, setNotConverted] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const result = useMemo(() => analyzeWorthiness(inputs), [inputs]);
  const sym = currencySign(currency);
  const fmt = (v: number) => formatMoney(v, currency);
  const pct = (v: number) => `${v.toFixed(1)}%`;
  const years = (v: number | null) =>
    v == null ? labels.res_never : `${v.toFixed(1)} ${labels.res_years}`;

  const set =
    (key: keyof WorthinessInputs) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setInputs((prev) => ({ ...prev, [key]: Number(event.target.value) || 0 }));

  const field = (
    key: keyof WorthinessInputs,
    label: string,
    step = 1,
  ) => (
    <label className="field" key={key}>
      {label}
      <input type="number" step={step} value={inputs[key]} onChange={set(key)} />
    </label>
  );

  const y1 = result.years[0];
  const y5 = result.years[4];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="card" style={{ padding: 20, overflow: "visible" }}>
        <h2 style={{ margin: "0 0 14px" }}>{labels.wor_deal}</h2>
        <div className="grid2 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field">
            {labels.wor_currency}
            <select
              value={currency}
              onChange={(e) => {
                const next = e.target.value as WorthinessCurrency;
                const switched = switchWorthinessCurrency(inputs, currency, next);
                setInputs(switched.inputs);
                setNotConverted(switched.kept);
                setCurrency(next);
              }}
            >
              <option value="GEL">GEL (₾)</option>
              <option value="USD">USD ($)</option>
            </select>
          </label>
          {notConverted && (
            <p className="hint" role="status" style={{ gridColumn: "1 / -1", margin: 0 }}>
              {labels.wor_not_converted}
            </p>
          )}
          {field("price", `${labels.wor_price} (${sym})`)}
          {field("equityPct", labels.wor_equity)}
          {field("otherInitialCosts", `${labels.wor_other_costs} (${sym})`)}
          {field("annualRatePct", labels.wor_rate, 0.1)}
          {field("loanYears", labels.wor_years)}
          {field("monthlyRent", `${labels.wor_rent} (${sym})`)}
          {field("rentGrowthPct", labels.wor_growth, 0.5)}
          {field("vacancyPct", labels.wor_vacancy)}
        </div>

        <button
          type="button"
          className="btn-chip"
          style={{ marginTop: 16 }}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "−" : "+"} {labels.wor_more}
        </button>
        {showMore && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
            {field("insurancePerYear", `${labels.wor_insurance} (${sym})`)}
            {field("maintenancePct", labels.wor_maintenance, 0.5)}
            {field("managementPct", labels.wor_management, 0.5)}
            {field("utilitiesPct", labels.wor_utilities, 0.5)}
            {field("brokerPct", labels.wor_broker, 0.5)}
            {field("hoaPerYear", `${labels.wor_hoa} (${sym})`)}
            {field("propertyTaxPct", labels.wor_proptax, 0.1)}
            {field("pointsPct", labels.wor_points, 0.5)}
            {field("incomeTaxPct", labels.wor_tax)}
            {field("units", labels.wor_units_n)}
          </div>
        )}
      </div>

      {/* min-width 0: a grid item may shrink below its table, which then
          scrolls inside its card instead of widening the phone page. */}
      <div style={{ minWidth: 0 }}>
        <div className="alert-card" style={{ alignItems: "center" }}>
          <h3 className="alert-card__title" style={{ fontSize: 16 }}>
            {labels[`wor_verdict_${result.verdict}`]}
          </h3>
          <span className={VERDICT_BADGE[result.verdict]}>
            {pct(y1.capRatePct)} {labels.wor_cap_short}
          </span>
        </div>

        <div className="kpi-grid kpi-grid--3d" style={{ margin: "14px 0", gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="kpi">
            <div className="kpi__label">{labels.wor_cf_month}</div>
            <div
              className="kpi__value"
              style={{
                color:
                  y1.atCashFlow >= 0
                    ? "var(--status-rented-text)"
                    : "var(--status-danger-text)",
              }}
            >
              {fmt(y1.atCashFlow / 12)}
            </div>
            <div className="kpi__sub">{labels.wor_payment}: {fmt(result.monthlyPayment)}</div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{labels.wor_coc}</div>
            <div className="kpi__value">{pct(y1.atCocPct)}</div>
            <div className="kpi__sub">{labels.wor_cap}: {pct(y1.capRatePct)}</div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{labels.wor_payback}</div>
            <div className="kpi__value">{years(result.paybackYears)}</div>
            <div className="kpi__sub">{labels.wor_invested}: {fmt(result.totalInvested)}</div>
          </div>
          <div className="kpi">
            <div className="kpi__label">{labels.wor_equity5}</div>
            <div className="kpi__value">{fmt(y5.equityValue)}</div>
            <div className="kpi__sub">{pct(y5.equityPct)}</div>
          </div>
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>{labels.wor_year}</th>
                <th className="num">{labels.wor_col_rent}</th>
                <th className="num">{labels.wor_col_noi}</th>
                <th className="num">{labels.wor_col_cf}</th>
                <th className="num">{labels.wor_col_coc}</th>
                <th className="num">{labels.wor_col_equity}</th>
              </tr>
            </thead>
            <tbody>
              {result.years.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td className="num" style={{ fontWeight: 400 }}>{fmt(row.monthlyRent)}</td>
                  <td className="num" style={{ fontWeight: 400 }}>{fmt(row.noi)}</td>
                  <td
                    className="num"
                    style={{
                      fontWeight: 500,
                      color:
                        row.atCashFlow >= 0
                          ? "var(--status-rented-text)"
                          : "var(--status-danger-text)",
                    }}
                  >
                    {fmt(row.atCashFlow)}
                  </td>
                  <td className="num" style={{ fontWeight: 400 }}>{pct(row.atCocPct)}</td>
                  <td className="num" style={{ fontWeight: 400 }}>{pct(row.equityPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="demo-hint" style={{ marginTop: 14 }}>{labels.wor_note}</p>
      </div>
    </div>
  );
}
