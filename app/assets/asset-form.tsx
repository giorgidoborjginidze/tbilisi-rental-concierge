"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAsset, deleteAsset } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";
import ListingInput from "./listing-input";

export interface AssetFormValues {
  id?: string;
  name: string;
  nameKa: string;
  category: string;
  type: string;
  city: string;
  district: string;
  address: string;
  areaSqm: string;
  estimatedValue: string;
  monthlyIncome: string;
  myhomeUrl: string;
  ssUrl: string;
  myautoUrl: string;
  airbnbUrl: string;
  bookingUrl: string;
  rentalMode: string;
  dailyRate: string;
  weekendPct: string;
  holidayPct: string;
  status: string;
  unitId: string;
  notes: string;
}


export default function AssetForm({
  asset,
  typesByCategory,
  categories,
  statuses,
  districts,
  units,
  labels,
  initialCategory,
}: {
  asset?: AssetFormValues;
  /** Preselects the category for a fresh form (e.g. ?category=income_source). */
  initialCategory?: string;
  typesByCategory: Record<string, { value: string; label: string }[]>;
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  districts: readonly string[];
  units: { id: string; label: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveAsset,
    null,
  );
  const [category, setCategory] = useState(
    asset?.category ?? initialCategory ?? "real_estate",
  );
  const [rentalMode, setRentalMode] = useState(asset?.rentalMode ?? "long_term");
  const types = typesByCategory[category] ?? [];

  // Existing listing URLs (edit mode) seed the smart link field.
  const initialLinks = [
    asset?.myhomeUrl, asset?.ssUrl, asset?.myautoUrl, asset?.airbnbUrl, asset?.bookingUrl,
  ].filter((u): u is string => Boolean(u));

  // Cars and real estate can both rent by the day; daily mode unlocks
  // per-day pricing (base rate + weekend/holiday premiums).
  const rentable = category === "real_estate" || category === "vehicle";
  const rentalModeField = (
    <label className="field">
      {labels.rental_mode}
      <select
        name="rentalMode"
        value={rentalMode}
        onChange={(event) => setRentalMode(event.target.value)}
      >
        <option value="long_term">{labels.mode_long_term}</option>
        <option value="daily">{labels.mode_daily}</option>
      </select>
    </label>
  );
  const dailyPricingFields = rentable && rentalMode === "daily" && (
    <>
      <label className="field">
        {labels.daily_rate}
        <input
          name="dailyRate" type="number" min={0} step="1"
          defaultValue={asset?.dailyRate}
        />
      </label>
      <label className="field">
        {labels.weekend_pct}
        <input
          name="weekendPct" type="number" min={0} max={500} step="1"
          defaultValue={asset?.weekendPct || "20"}
        />
      </label>
      <label className="field">
        {labels.holiday_pct}
        <input
          name="holidayPct" type="number" min={0} max={500} step="1"
          defaultValue={asset?.holidayPct || "30"}
        />
      </label>
      <span className="hint">{labels.daily_pricing_hint}</span>
    </>
  );

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {asset?.id && <input type="hidden" name="assetId" value={asset.id} />}

      <label className="field">
        {labels.unit_name}
        <input name="name" required defaultValue={asset?.name} />
      </label>
      <label className="field">
        {labels.unit_name_ka}
        <input name="nameKa" defaultValue={asset?.nameKa} />
      </label>

      <label className="field">
        {labels.asset_category}
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
         
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {labels.unit_type}
        <select name="type" defaultValue={asset?.type}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>

      {category === "income_source" ? (
        <input type="hidden" name="status" value="personal_use" />
      ) : (
        <>
          <label className="field">
            {labels.status_label}
            <select name="status" defaultValue={asset?.status ?? "personal_use"}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            {labels.asset_link_unit}
            <select name="unitId" defaultValue={asset?.unitId ?? ""}>
              <option value="">{labels.asset_none}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.label}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {category === "real_estate" && (
        <>
          <label className="field">
            {labels.unit_city}
            <input name="city" defaultValue={asset?.city ?? "Tbilisi"} />
          </label>
          <label className="field">
            {labels.unit_district}
            <input
              name="district" list="asset-district-options"
              defaultValue={asset?.district}
            />
            <datalist id="asset-district-options">
              {districts.map((district) => (
                <option key={district} value={district} />
              ))}
            </datalist>
          </label>
          <label className="field sm:col-span-2">
            {labels.unit_address}
            <input name="address" defaultValue={asset?.address} />
          </label>
          <label className="field">
            {labels.asset_area}
            <input
              name="areaSqm" type="number" min={0} step="0.1"
              defaultValue={asset?.areaSqm}
            />
          </label>
          {rentalModeField}
          {dailyPricingFields}
          <ListingInput initial={initialLinks} labels={labels} />
        </>
      )}

      {category === "vehicle" && (
        <>
          {rentalModeField}
          {dailyPricingFields}
          <ListingInput initial={initialLinks} labels={labels} />
        </>
      )}

      {category === "income_source" ? (
        <>
          <label className="field">
            {labels.income_monthly}
            <input
              name="monthlyIncome" type="number" min={0} step="0.01"
              defaultValue={asset?.monthlyIncome}
            />
          </label>
          <span className="hint sm:col-span-2">{labels.income_source_hint}</span>
        </>
      ) : (
        <label className="field">
          {labels.asset_value}
          <input
            name="estimatedValue" type="number" min={0} step="1"
            defaultValue={asset?.estimatedValue}
          />
        </label>
      )}

      <label className="field sm:col-span-2">
        {labels.asset_notes}
        <textarea name="notes" rows={2} defaultValue={asset?.notes} />
      </label>

      {state?.error && (
        <p className="sm:col-span-2" style={{ color: "var(--status-danger-text)", fontSize: 13 }}>{labels[state.error]}</p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {labels.save}
        </button>
        <Link href="/assets" className="link">
          {labels.cancel}
        </Link>
        {asset?.id && (
          <button
            type="submit"
            formAction={(formData) => {
              if (confirm(labels.asset_delete_confirm)) return deleteAsset(formData);
            }}
            formNoValidate
            className="ml-auto btn-danger"
          >
            {labels.delete}
          </button>
        )}
      </div>
    </form>
  );
}
