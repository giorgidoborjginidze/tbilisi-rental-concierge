"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAsset, deleteAsset } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";

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
  status: string;
  unitId: string;
  notes: string;
}

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";
const labelClass = "flex flex-col gap-1 text-sm";

export default function AssetForm({
  asset,
  typesByCategory,
  categories,
  statuses,
  districts,
  units,
  labels,
}: {
  asset?: AssetFormValues;
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
  const [category, setCategory] = useState(asset?.category ?? "real_estate");
  const types = typesByCategory[category] ?? [];

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {asset?.id && <input type="hidden" name="assetId" value={asset.id} />}

      <label className={labelClass}>
        {labels.unit_name}
        <input name="name" required defaultValue={asset?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.unit_name_ka}
        <input name="nameKa" defaultValue={asset?.nameKa} className={inputClass} />
      </label>

      <label className={labelClass}>
        {labels.asset_category}
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={inputClass}
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {labels.unit_type}
        <select name="type" defaultValue={asset?.type} className={inputClass}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {labels.status_label}
        <select name="status" defaultValue={asset?.status ?? "personal_use"} className={inputClass}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {labels.asset_link_unit}
        <select name="unitId" defaultValue={asset?.unitId ?? ""} className={inputClass}>
          <option value="">{labels.asset_none}</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.label}</option>
          ))}
        </select>
      </label>

      {category === "real_estate" && (
        <>
          <label className={labelClass}>
            {labels.unit_city}
            <input name="city" defaultValue={asset?.city ?? "Tbilisi"} className={inputClass} />
          </label>
          <label className={labelClass}>
            {labels.unit_district}
            <input
              name="district" list="asset-district-options"
              defaultValue={asset?.district} className={inputClass}
            />
            <datalist id="asset-district-options">
              {districts.map((district) => (
                <option key={district} value={district} />
              ))}
            </datalist>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            {labels.unit_address}
            <input name="address" defaultValue={asset?.address} className={inputClass} />
          </label>
          <label className={labelClass}>
            {labels.asset_area}
            <input
              name="areaSqm" type="number" min={0} step="0.1"
              defaultValue={asset?.areaSqm} className={inputClass}
            />
          </label>
        </>
      )}

      <label className={labelClass}>
        {labels.asset_value}
        <input
          name="estimatedValue" type="number" min={0} step="1"
          defaultValue={asset?.estimatedValue} className={inputClass}
        />
      </label>

      <label className={`${labelClass} sm:col-span-2`}>
        {labels.asset_notes}
        <textarea name="notes" rows={2} defaultValue={asset?.notes} className={inputClass} />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 sm:col-span-2">{labels[state.error]}</p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {labels.save}
        </button>
        <Link href="/assets" className="text-sm text-neutral-500 hover:underline">
          {labels.cancel}
        </Link>
        {asset?.id && (
          <button
            type="submit"
            formAction={(formData) => {
              if (confirm(labels.asset_delete_confirm)) return deleteAsset(formData);
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
