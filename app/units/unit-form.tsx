"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveUnit, deleteUnit, type FormState } from "@/lib/units/actions";

export interface UnitFormValues {
  id?: string;
  name: string;
  nameKa: string;
  city: string;
  district: string;
  address: string;
  type: string;
  capacity: number;
  bedrooms: number;
  baseNightlyRate: number;
  currency: string;
  amenities: string;
  airbnbUrl: string;
  bookingUrl: string;
  icalUrls: string;
}


export default function UnitForm({
  unit,
  cities,
  districts,
  types,
  labels,
}: {
  unit?: UnitFormValues;
  cities: readonly string[];
  districts: readonly string[];
  types: { value: string; label: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveUnit,
    null,
  );

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {unit?.id && <input type="hidden" name="unitId" value={unit.id} />}

      <label className="field">
        {labels.unit_name}
        <input name="name" required defaultValue={unit?.name} />
      </label>
      <label className="field">
        {labels.unit_name_ka}
        <input name="nameKa" defaultValue={unit?.nameKa} />
      </label>

      <label className="field">
        {labels.unit_city}
        <select name="city" defaultValue={unit?.city ?? cities[0]}>
          {cities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {labels.unit_district}
        <input
          name="district"
          required
          list="district-options"
          defaultValue={unit?.district}
         
        />
        <datalist id="district-options">
          {districts.map((district) => (
            <option key={district} value={district} />
          ))}
        </datalist>
      </label>

      <label className="field sm:col-span-2">
        {labels.unit_address}
        <input name="address" required defaultValue={unit?.address} />
      </label>

      <label className="field">
        {labels.unit_type}
        <select name="type" defaultValue={unit?.type ?? types[0]?.value}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {labels.unit_currency}
        <select name="currency" defaultValue={unit?.currency ?? "GEL"}>
          {["GEL", "USD", "EUR"].map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </label>

      <label className="field">
        {labels.unit_capacity}
        <input
          name="capacity" type="number" min={1} required
          defaultValue={unit?.capacity ?? 2}
        />
      </label>
      <label className="field">
        {labels.unit_bedrooms}
        <input
          name="bedrooms" type="number" min={0} required
          defaultValue={unit?.bedrooms ?? 1}
        />
      </label>

      <label className="field">
        {labels.unit_base_rate}
        <input
          name="baseNightlyRate" type="number" min={1} step="0.01" required
          defaultValue={unit?.baseNightlyRate}
        />
      </label>
      <label className="field">
        {labels.unit_amenities}
        <input
          name="amenities" placeholder="wifi, ac, washer"
          defaultValue={unit?.amenities}
        />
      </label>

      <label className="field">
        {labels.unit_airbnb_url}
        <input name="airbnbUrl" type="url" defaultValue={unit?.airbnbUrl} />
      </label>
      <label className="field">
        {labels.unit_booking_url}
        <input name="bookingUrl" type="url" defaultValue={unit?.bookingUrl} />
      </label>

      <label className="field sm:col-span-2">
        {labels.unit_ical_urls}
        <textarea
          name="icalUrls" rows={3} defaultValue={unit?.icalUrls}
          className="font-mono text-xs"
        />
        <span className="hint">{labels.unit_ical_hint}</span>
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
        <Link href="/units" className="link">
          {labels.cancel}
        </Link>
        {unit?.id && (
          <button
            type="submit"
            formAction={(formData) => {
              if (confirm(labels.delete_confirm)) return deleteUnit(formData);
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
