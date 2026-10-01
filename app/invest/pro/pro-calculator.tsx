"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScenario } from "@/lib/invest/saved-actions";
import type { SavedScenario } from "@/lib/invest/saved";
import {
  analyzeWorthiness,
  isWorthinessExample,
  switchWorthinessCurrency,
  WORTHINESS_DEFAULTS_GEL,
  type TaxModel,
  type WorthinessCurrency,
  type WorthinessInputs,
} from "@/lib/invest/worthiness";
import { PAYBACK_CAP_YEARS } from "@/lib/invest/market";
import { currencySign, formatMoneyInline } from "@/lib/format";
import { TONE_BADGE, VERDICT_BADGE } from "@/lib/ui/tone";
import Kpi from "../../kpi";

export default function ProCalculator({
  labels,
  initial = null,
  canSave = true,
  justSaved = false,
}: {
  labels: Record<string, string>;
  /** A kept scenario opened from the list (?calc=…). */
  initial?: { id: string; name: string; scenario: SavedScenario } | null;
  /** False for the demo / view-only: the figures can be tried, not kept. */
  canSave?: boolean;
  /** Just kept (?saved=1): the confirmation survives the reload to the kept scenario. */
  justSaved?: boolean;
}) {
  // Lari first, like the free calculator; dollars stay one click away.
  const [inputs, setInputs] = useState<WorthinessInputs>(initial?.scenario.inputs ?? WORTHINESS_DEFAULTS_GEL);
  const [currency, setCurrency] = useState<WorthinessCurrency>(initial?.scenario.currency ?? "GEL");
  // Keeping the scenario: its name, and the kept row it updates.
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [saveNote, setSaveNote] = useState<string | null>(justSaved ? labels.calc_saved : null);
  const [saving, startSaving] = useTransition();
  const save = (asNew: boolean) =>
    startSaving(async () => {
      const result = await saveScenario({ id: asNew ? null : savedId, name, data: { inputs, currency } });
      if ("id" in result) {
        setSavedId(result.id);
        setSaveNote(labels.calc_saved);
        router.replace(`/invest/pro?calc=${result.id}&saved=1`, { scroll: false });
        router.refresh();
      } else {
        setSaveNote(labels[result.error] ?? labels.error_required);
      }
    });
  // The owner's own figures were kept through a currency switch.
  const [notConverted, setNotConverted] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const result = useMemo(() => analyzeWorthiness(inputs), [inputs]);
  const sym = currencySign(currency);
  const fmt = (v: number) => formatMoneyInline(v, currency);
  const pct = (v: number) => `${v.toFixed(1)}%`;
  // Past 30 years a payback is not a plan: "30+ years", not "483.3".
  const years = (v: number | null) =>
    v == null
      ? labels.res_never
      : v > PAYBACK_CAP_YEARS
        ? labels.res_years_over.replace("{n}", String(PAYBACK_CAP_YEARS))
        : `${v.toFixed(1)} ${labels.res_years}`;
  // Until the owner types a figure, the page shows an example — and says
  // so instead of handing out a verdict about nobody's flat.
  const example = isWorthinessExample(inputs, currency);

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
      <div className="card" style={{ padding: 20, overflow: "visible", minWidth: 0 }}>
        <h2 style={{ margin: "0 0 14px" }}>{labels.wor_deal}</h2>
        <div className="grid2 grid gap-3 calc-form" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
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
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            {labels.wor_tax_model}
            <select
              value={inputs.taxModel}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, taxModel: e.target.value as TaxModel }))
              }
            >
              <option value="gross">{labels.wor_tax_gross}</option>
              <option value="profit">{labels.wor_tax_profit}</option>
            </select>
            <span className="hint">{labels.wor_tax_hint}</span>
          </label>
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
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 14 }}>
            {field("insurancePerYear", `${labels.wor_insurance} (${sym})`)}
            {field("maintenancePct", labels.wor_maintenance, 0.5)}
            {field("managementPct", labels.wor_management, 0.5)}
            {field("utilitiesPct", labels.wor_utilities, 0.5)}
            {field("brokerPct", labels.wor_broker, 0.5)}
            {field("hoaPerYear", `${labels.wor_hoa} (${sym})`)}
            {field("propertyTaxPct", labels.wor_proptax, 0.1)}
            {field("pointsPct", labels.wor_points, 0.5)}
            {inputs.taxModel === "gross" ? (
              field("grossTaxPct", labels.wor_tax_gross_pct, 0.5)
            ) : (
              <>
                {field("incomeTaxPct", labels.wor_tax)}
                {field("buildingSharePct", labels.wor_building_share)}
                {field("depreciationYears", labels.wor_depr_years, 0.5)}
              </>
            )}
          </div>
        )}
        {canSave && (
          <div className="calc-save">
            <label className="field" style={{ flex: "1 1 200px" }}>
              {labels.calc_name}
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={labels.calc_name_ph} maxLength={80} />
            </label>
            <button type="button" className="btn-primary" disabled={saving || !name.trim()} onClick={() => save(false)}>
              {savedId ? labels.calc_save_changes : labels.calc_save}
            </button>
            {savedId && (
              <button type="button" className="btn-secondary" disabled={saving || !name.trim()} onClick={() => save(true)}>
                {labels.calc_save_new}
              </button>
            )}
            {saveNote && <p role="status" className="field-hint" style={{ flexBasis: "100%", margin: 0 }}>{saveNote}</p>}
          </div>
        )}
      </div>

      {/* min-width 0: a grid item may shrink below its table, which then
          scrolls inside its card instead of widening the phone page. */}
      <div style={{ minWidth: 0 }}>
        {example ? (
          <div className="alert-card" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <h3 className="alert-card__title" style={{ fontSize: 16 }}>
              {labels.wor_example_title}
            </h3>
            <span className={`badge ${TONE_BADGE.muted}`}>{labels.wor_example_badge}</span>
            <div className="alert-card__detail" style={{ flexBasis: "100%" }}>
              {labels.wor_example_hint}
            </div>
          </div>
        ) : (
          <div className="alert-card" style={{ alignItems: "center" }}>
            <h3 className="alert-card__title" style={{ fontSize: 16 }}>
              {labels[`wor_verdict_${result.verdict}`]}
            </h3>
            <span className={VERDICT_BADGE[result.verdict]}>
              {pct(y1.capRatePct)} {labels.wor_cap_short}
            </span>
          </div>
        )}

        <div className="kpi-grid kpi-grid--3d" style={{ margin: "14px 0", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Kpi
            label={labels.wor_cf_month}
            value={fmt(y1.atCashFlow / 12)}
            valueStyle={{ color: y1.atCashFlow >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)" }}
            sub={`${labels.wor_payment}: ${fmt(result.monthlyPayment)}`}
          />
          <Kpi label={labels.wor_coc} value={pct(y1.atCocPct)} sub={`${labels.wor_cap}: ${pct(y1.capRatePct)}`} />
          <Kpi
            label={labels.wor_payback}
            value={years(result.paybackYears)}
            sub={`${labels.wor_invested}: ${fmt(result.totalInvested)}`}
          />
          <Kpi label={labels.wor_equity5} value={fmt(y5.equityValue)} sub={pct(y5.equityPct)} />
        </div>

        {/* On a phone each year is a small card with its labels (no sideways
            scroll, nothing cut at the edge); wider, a table whose figures
            never break. Focusable, so a keyboard can scroll it if it must. */}
        <div className="card table-stack pro-years" tabIndex={0} role="region" aria-label={labels.wor_year}>
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
                  <td className="table-stack__title">{labels.wor_year} {row.year}</td>
                  <td className="num" data-label={labels.wor_col_rent} style={{ fontWeight: 400 }}>{fmt(row.monthlyRent)}</td>
                  <td className="num" data-label={labels.wor_col_noi} style={{ fontWeight: 400 }}>{fmt(row.noi)}</td>
                  <td
                    className="num table-stack__key"
                    data-label={labels.wor_col_cf}
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
                  <td className="num" data-label={labels.wor_col_coc} style={{ fontWeight: 400 }}>{pct(row.atCocPct)}</td>
                  <td className="num" data-label={labels.wor_col_equity} style={{ fontWeight: 400 }}>{pct(row.equityPct)}</td>
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
