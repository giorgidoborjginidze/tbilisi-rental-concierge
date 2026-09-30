"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveUnit, deleteUnit, type FormState } from "@/lib/units/actions";
import ConfirmAction from "@/app/confirm-action";
import { FormMessage, Req, RequiredLegend } from "@/app/form-bits";
import { IconTrash } from "@/app/icons";
import { keepTyped } from "@/app/keep-typed";

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
  feedStatus,
  assets,
  linkedAsset,
}: {
  unit?: UnitFormValues;
  cities: { value: string; label: string }[];
  districts: readonly string[];
  types: { value: string; label: string }[];
  labels: Record<string, string>;
  /** How each saved iCal link last synced (rendered on the server). */
  feedStatus?: React.ReactNode;
  /** Real-estate assets without a unit, which this unit may be linked to. */
  assets: { id: string; label: string }[];
  /** The asset this unit is already linked to (edit). */
  linkedAsset?: { id: string; label: string } | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveUnit,
    null,
  );
  // After an error the form shows what was submitted, not the saved unit.
  const sent = state && "values" in state ? state.values : undefined;
  const val = (name: keyof UnitFormValues) =>
    sent ? (sent[name] ?? "") : unit?.[name] === undefined ? undefined : String(unit[name]);
  // The extra details start open when the unit already has some (or an
  // error came back with some typed).
  const hasExtra = Boolean(
    val("nameKa") || val("amenities") || val("airbnbUrl") || val("bookingUrl"),
  );

  return (
    <>
    <form action={formAction} onSubmit={keepTyped(formAction)} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {unit?.id && <input type="hidden" name="unitId" value={unit.id} />}
      <RequiredLegend text={labels.form_required_legend} />

      <label className="field">
        <span>
          {labels.unit_name}
          <Req />
        </span>
        <input name="name" required aria-required="true" defaultValue={val("name")} />
      </label>
      <label className="field">
        {labels.unit_city}
        <select name="city" defaultValue={val("city") ?? cities[0]?.value}>
          {cities.map((city) => (
            <option key={city.value} value={city.value}>{city.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          {labels.unit_district}
          <Req />
        </span>
        <input
          name="district"
          required
          aria-required="true"
          list="district-options"
          defaultValue={val("district")}
         
        />
        <datalist id="district-options">
          {districts.map((district) => (
            <option key={district} value={district} />
          ))}
        </datalist>
      </label>

      <label className="field sm:col-span-2">
        <span>
          {labels.unit_address}
          <Req />
        </span>
        <input name="address" required aria-required="true" defaultValue={val("address")} />
      </label>

      <label className="field">
        {labels.unit_type}
        <select name="type" defaultValue={val("type") ?? types[0]?.value}>
          {types.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        {labels.unit_currency}
        <select name="currency" defaultValue={val("currency") ?? "GEL"}>
          {["GEL", "USD", "EUR"].map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          {labels.unit_capacity}
          <Req />
        </span>
        <input
          name="capacity" type="number" min={1} required aria-required="true"
          defaultValue={val("capacity") ?? 2}
        />
      </label>
      <label className="field">
        <span>
          {labels.unit_bedrooms}
          <Req />
        </span>
        <input
          name="bedrooms" type="number" min={0} required aria-required="true"
          defaultValue={val("bedrooms") ?? 1}
        />
      </label>

      <label className="field">
        <span>
          {labels.unit_base_rate}
          <Req />
        </span>
        <input
          name="baseNightlyRate" type="number" inputMode="decimal" min={1} step="0.01" required aria-required="true"
          defaultValue={val("baseNightlyRate")}
        />
      </label>

      <label className="field sm:col-span-2">
        {labels.unit_ical_urls}
        <textarea
          name="icalUrls" rows={3} defaultValue={val("icalUrls")}
          className="font-mono text-xs"
        />
        <span className="hint">{labels.unit_ical_hint}</span>
      </label>


      {feedStatus && <div className="sm:col-span-2">{feedStatus}</div>}

      {/* One name up top; the Georgian name and the rest wait here, as on
          the asset form. */}
      <details className="form-fold" open={hasExtra}>
        <summary>
          {labels.form_more}
          <span className="form-fold__hint">{labels.form_more_hint_unit}</span>
        </summary>
        <div className="form-fold__body">
          <label className="field">
            {labels.asset_name_ka}
            <input name="nameKa" defaultValue={val("nameKa")} />
          </label>
          <label className="field">
            {labels.unit_amenities}
            <input
              name="amenities" placeholder={labels.ph_amenities}
              defaultValue={val("amenities")}
            />
          </label>
          <label className="field">
            {labels.unit_airbnb_url}
            <input name="airbnbUrl" type="url" defaultValue={val("airbnbUrl")} />
          </label>
          <label className="field">
            {labels.unit_booking_url}
            <input name="bookingUrl" type="url" defaultValue={val("bookingUrl")} />
          </label>
        </div>
      </details>

      {/* The same flat under Assets: its value, contracts and daily
          answers. A new unit gets one unless an existing one is picked. */}
      {linkedAsset ? (
        <p className="field sm:col-span-2" style={{ margin: 0 }}>
          {labels.unit_asset_link}
          <Link href={`/assets/${linkedAsset.id}/edit`} className="link" style={{ fontWeight: 600 }}>
            {linkedAsset.label}
          </Link>
        </p>
      ) : (
        <label className="field sm:col-span-2">
          {labels.unit_asset_link}
          <select
            name="linkAssetId"
            defaultValue={sent?.linkAssetId ?? (unit?.id ? "" : "__new__")}
          >
            {unit?.id && <option value="">{labels.unit_asset_none}</option>}
            <option value="__new__">{labels.unit_asset_new}</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.label}</option>
            ))}
          </select>
          <span className="hint">{labels.unit_asset_hint}</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
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
        <FormMessage
          error={state?.error ? labels[state.error] ?? state.error : null}
          detail={state?.error ? state.detail : null}
        />
      </div>
    </form>

    {/* Deleting sits apart from saving and asks in the page. */}
    {unit?.id && (
      <div className="danger-zone">
        <ConfirmAction
          action={deleteUnit}
          fields={{ unitId: unit.id }}
          trigger={
            <>
              <IconTrash size={15} /> {labels.delete}
            </>
          }
          triggerClassName="btn-danger btn-compact icon-text"
          question={labels.delete_confirm}
          confirmLabel={labels.delete}
          cancelLabel={labels.cancel}
        />
      </div>
    )}
    </>
  );
}
