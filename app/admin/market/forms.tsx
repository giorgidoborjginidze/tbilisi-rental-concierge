"use client";

import { useActionState } from "react";
import { importListings, saveReportFigures, type AdminState } from "@/lib/market/admin-actions";

const Note = ({ state, labels }: { state: AdminState; labels: Record<string, string> }) =>
  state?.ok ? (
    <p role="status" className="field-hint" style={{ margin: 0, color: "var(--status-rented-text)" }}>
      {labels.market_saved.replace("{n}", state.ok)}
    </p>
  ) : state?.error ? (
    <p role="alert" className="form-error" style={{ margin: 0 }}>{labels[state.error] ?? state.error}</p>
  ) : null;

export function ReportForm({ labels, month }: { labels: Record<string, string>; month: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveReportFigures, null);
  return (
    <form action={action} className="card form-grid" style={{ padding: 18 }}>
      <label className="field">
        {labels.market_source_name}
        <input name="sourceName" placeholder="TBC Capital" required list="report-sources" />
        <datalist id="report-sources">
          <option value="TBC Capital" />
          <option value="Galt & Taggart" />
          <option value="Colliers Georgia" />
          <option value="Geostat" />
        </datalist>
      </label>
      <label className="field">
        {labels.market_period}
        <input name="period" type="month" defaultValue={month} required />
      </label>
      <label className="field col-span-2">
        {labels.market_lines}
        <textarea name="lines" rows={7} placeholder={"ვაკე, ქირა, 32\nსაბურთალო, გაყიდვა, 3300\nVera, occupancy, 68%"} required />
        <span className="field-hint">{labels.market_lines_hint}</span>
      </label>
      <label className="field col-span-2">
        {labels.market_note}
        <input name="note" placeholder="Q3 2026 residential market report, p. 12" />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>{labels.market_save}</button>
        <Note state={state} labels={labels} />
      </div>
    </form>
  );
}

export function ListingsForm({ labels, month }: { labels: Record<string, string>; month: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(importListings, null);
  return (
    <form action={action} className="card form-grid" style={{ padding: 18 }}>
      <label className="field">
        {labels.market_listings_source}
        <input name="sourceName" placeholder="myhome.ge" list="listing-sources" />
        <datalist id="listing-sources">
          <option value="myhome.ge" />
          <option value="ss.ge" />
        </datalist>
      </label>
      <label className="field">
        {labels.market_period}
        <input name="period" type="month" defaultValue={month} required />
      </label>
      <label className="field col-span-2">
        {labels.market_file}
        <input name="file" type="file" accept=".csv,.tsv,.txt,text/csv" />
      </label>
      <label className="field col-span-2">
        {labels.market_paste}
        <textarea name="csv" rows={5} placeholder={"district;type;price;currency;area\nვაკე;ქირა;1500;GEL;55\nსაბურთალო;იყიდება;95000;USD;70"} />
        <span className="field-hint">{labels.market_listings_hint}</span>
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>{labels.market_import}</button>
        <Note state={state} labels={labels} />
      </div>
    </form>
  );
}
