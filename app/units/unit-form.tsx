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

const inputClass =
  "w-full rounded border border-line-strong bg-white px-3 py-2 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

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

      <label className={labelClass}>
        {labels.unit_name}
        <input name="name" required defaultValue={unit?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.unit_name_ka}
        <input name="nameKa" defaultValue={unit?.nameKa} className={inputClass} />
      </label>

      <label className={labelClass}>
        {labels.unit_city}
        <select name="city" defaultValue={unit?.city ?? cities[0]} className={inputClass}>
          {cities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {labels.unit_district}
        <input
          name="district"
          required
          list="district-options"
          defaultValue={unit?.district}
          className={inputClass}
        />
        <datalist id="district-options">
          {districts.map((district) => (
            <option key={district} value={district} />
          ))}
        </datalist>
      </label>

      <label className={`${labelClass} sm:col-span-2`}>
        {labels.unit_address}
        <input name="address" required defaultValue={unit?.address} className={inputClass} />
      </label>

      <label className={labelClass}>
        {labels.unit_type}
        <select name="type" defaultValue={unit?.type ?? types[0]?.value} className={inputClass}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {labels.unit_currency}
        <select name="currency" defaultValue={unit?.currency ?? "GEL"} className={inputClass}>
          {["GEL", "USD", "EUR"].map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {labels.unit_capacity}
        <input
          name="capacity" type="number" min={1} required
          defaultValue={unit?.capacity ?? 2} className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {labels.unit_bedrooms}
        <input
          name="bedrooms" type="number" min={0} required
          defaultValue={unit?.bedrooms ?? 1} className={inputClass}
        />
      </label>

      <label className={labelClass}>
        {labels.unit_base_rate}
        <input
          name="baseNightlyRate" type="number" min={1} step="0.01" required
          defaultValue={unit?.baseNightlyRate} className={inputClass}
        />
      </label>
      <label className={labelClass}>
        {labels.unit_amenities}
        <input
          name="amenities" placeholder="wifi, ac, washer"
          defaultValue={unit?.amenities} className={inputClass}
        />
      </label>

      <label className={labelClass}>
        {labels.unit_airbnb_url}
        <input name="airbnbUrl" type="url" defaultValue={unit?.airbnbUrl} className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.unit_booking_url}
        <input name="bookingUrl" type="url" defaultValue={unit?.bookingUrl} className={inputClass} />
      </label>

      <label className={`${labelClass} sm:col-span-2`}>
        {labels.unit_ical_urls}
        <textarea
          name="icalUrls" rows={3} defaultValue={unit?.icalUrls}
          className={`${inputClass} font-mono text-xs`}
        />
        <span className="text-xs text-neutral-500">{labels.unit_ical_hint}</span>
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 sm:col-span-2">{labels[state.error]}</p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-primary-dark disabled:opacity-50"
        >
          {labels.save}
        </button>
        <Link href="/units" className="text-sm text-neutral-500 hover:underline">
          {labels.cancel}
        </Link>
        {unit?.id && (
          <button
            type="submit"
            formAction={(formData) => {
              if (confirm(labels.delete_confirm)) return deleteUnit(formData);
            }}
            formNoValidate
            className="ml-auto rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {labels.delete}
          </button>
        )}
      </div>
    </form>
  );
}
