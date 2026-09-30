"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAsset, deleteAsset } from "@/lib/assets/actions";
import type { FormState } from "@/lib/units/actions";
import ListingInput from "./listing-input";
import ContractFields from "./contract-fields";
import ConfirmAction from "@/app/confirm-action";
import { FormMessage, Req, RequiredLegend } from "@/app/form-bits";
import { IconTrash } from "@/app/icons";
import { keepTyped } from "@/app/keep-typed";
import { todayKey } from "@/lib/time";

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
  /** The linked unit's iCal links, one per line. */
  icalUrls: string;
  /** A car's state plate. */
  plateNumber: string;
  notes: string;
}

type Option = { symbol: string; name: string };
const CUSTOM = "__custom__";

const HOLDING_CATEGORIES = ["crypto", "stock", "metal"];
// What can be let to someone with a contract from this form.
const CONTRACT_CATEGORIES = ["real_estate", "vehicle", "other"];

// One form for every asset. What matters first is on top — the category,
// one name, the status, how it is let, its value — and the rest waits
// under "More details". A new asset marked "rented" asks for the tenant
// and the rent in the same save, so it never shows "rented" with no rent.
// Required fields carry a star; an error keeps everything typed.
export default function AssetForm({
  asset,
  displayName,
  typesByCategory,
  categories,
  statuses,
  districts,
  cities,
  units,
  labels,
  initialCategory,
  initialStatus,
  initialMode,
  coins,
  stocks,
  metals,
}: {
  asset?: AssetFormValues;
  /** The asset's name as the owner reads it (the delete question). */
  displayName?: string;
  /** Preselects the category for a fresh form (e.g. ?category=crypto). */
  initialCategory?: string;
  /** Preselects the status (a car rental's new car is "rented"). */
  initialStatus?: string;
  /** Preselects how it is let ("daily" for a day-let flat). */
  initialMode?: string;
  typesByCategory: Record<string, { value: string; label: string }[]>;
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  districts: readonly string[];
  /** City names in the owner's language; the first is the default. */
  cities: readonly string[];
  units: { id: string; label: string }[];
  labels: Record<string, string>;
  coins: Option[];
  stocks: Option[];
  metals: Option[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveAsset,
    null,
  );
  // After an error the form shows what was submitted, not the stored asset.
  const sent = state && "values" in state ? state.values : undefined;
  const val = (key: keyof AssetFormValues): string | undefined =>
    sent ? (sent[key] ?? "") : asset?.[key];

  const [category, setCategory] = useState(
    asset?.category ?? initialCategory ?? "real_estate",
  );
  const [rentalMode, setRentalMode] = useState(asset?.rentalMode ?? initialMode ?? "long_term");
  const [status, setStatus] = useState(asset?.status ?? initialStatus ?? "personal_use");
  const [withTenant, setWithTenant] = useState(true);
  const [metalUnit, setMetalUnit] = useState<"oz" | "g">("oz");
  // Unknown or odd keys (?category=__proto__) have no types, not a crash.
  const types = Object.hasOwn(typesByCategory, category) ? typesByCategory[category] : [];

  const isHolding = HOLDING_CATEGORIES.includes(category);
  const holdingOptions =
    category === "crypto" ? coins : category === "stock" ? stocks : metals;
  const [symbol, setSymbol] = useState(holdingOptions[0]?.symbol ?? "");
  const isCustomSymbol = symbol === CUSTOM;

  // Switching category resets the holding picker to that category's first option.
  const onCategoryChange = (next: string) => {
    setCategory(next);
    const opts =
      next === "crypto" ? coins : next === "stock" ? stocks : next === "metal" ? metals : [];
    setSymbol(opts[0]?.symbol ?? "");
  };
  const onModeChange = (next: string) => {
    setRentalMode(next);
    // A flat let by the day is for letting: "personal use" no longer fits.
    if (next === "daily" && status === "personal_use") setStatus("vacant");
  };

  // Existing listing URLs (edit mode) seed the smart link field.
  const initialLinks = [
    asset?.myhomeUrl, asset?.ssUrl, asset?.myautoUrl, asset?.airbnbUrl, asset?.bookingUrl,
  ].filter((u): u is string => Boolean(u));

  // Cars and real estate can both rent by the day; daily mode unlocks
  // per-day pricing (base rate + weekend/holiday premiums).
  const rentable = category === "real_estate" || category === "vehicle";
  const isNew = !asset?.id;
  // The "tenant & rent" step: a new asset let to someone long-term.
  const tenantStep =
    isNew && status === "rented" && CONTRACT_CATEGORIES.includes(category) && rentalMode !== "daily";
  // The extra details start open when the asset already has some.
  const hasExtra = Boolean(
    asset?.address || asset?.areaSqm || asset?.notes || asset?.nameKa || asset?.icalUrls ||
      initialLinks.length > 0 || asset?.unitId,
  );

  const rentalModeField = (
    <label className="field">
      {labels.rental_mode}
      <select name="rentalMode" value={rentalMode} onChange={(event) => onModeChange(event.target.value)}>
        <option value="long_term">{labels.mode_long_term}</option>
        <option value="daily">{labels.mode_daily}</option>
      </select>
    </label>
  );
  const dailyPricingFields = rentable && rentalMode === "daily" && (
    <>
      <label className="field">
        {labels.daily_rate}
        <input name="dailyRate" type="number" inputMode="decimal" min={0} step="1" defaultValue={val("dailyRate")} />
      </label>
      <label className="field">
        {labels.weekend_pct}
        <input name="weekendPct" type="number" min={0} max={500} step="1" defaultValue={val("weekendPct") || "20"} />
      </label>
      <label className="field">
        {labels.holiday_pct}
        <input name="holidayPct" type="number" min={0} max={500} step="1" defaultValue={val("holidayPct") || "30"} />
      </label>
      <span className="hint">{labels.daily_pricing_hint}</span>
    </>
  );

  return (
    <>
      <form
        action={formAction}
        onSubmit={keepTyped(formAction)}
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {asset?.id && <input type="hidden" name="assetId" value={asset.id} />}
        <RequiredLegend text={labels.form_required_legend} />

        {/* Category is the first choice; the rest of the form follows from it. */}
        <label className="field sm:col-span-2">
          <span>
            {labels.asset_category}
            <Req />
          </span>
          <select
            name="category"
            value={category}
            required
            aria-required="true"
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>

        {isHolding ? (
          <>
            <label className="field sm:col-span-2">
              <span>
                {category === "crypto"
                  ? labels.crypto_coin
                  : category === "stock"
                    ? labels.stock_ticker
                    : labels.metal_type}
                <Req />
              </span>
              <select
                name={isCustomSymbol ? undefined : "symbol"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {holdingOptions.map((o) => (
                  <option key={o.symbol} value={o.symbol}>
                    {o.name} ({o.symbol})
                  </option>
                ))}
                {category !== "metal" && <option value={CUSTOM}>{labels.crypto_custom}</option>}
              </select>
            </label>

            {isCustomSymbol && category === "crypto" && (
              <>
                <label className="field">
                  <span>
                    {labels.crypto_custom_symbol}
                    <Req />
                  </span>
                  <input
                    name="symbol"
                    placeholder={labels.ph_crypto_symbol}
                    autoCapitalize="characters"
                    required
                    aria-required="true"
                    defaultValue={sent?.symbol}
                  />
                </label>
                <label className="field">
                  {labels.crypto_custom_id}
                  <input name="coingeckoId" placeholder={labels.ph_crypto_id} defaultValue={sent?.coingeckoId} />
                  <span className="hint">{labels.crypto_custom_id_hint}</span>
                </label>
                <label className="field sm:col-span-2">
                  {labels.unit_name}
                  <input name="name" placeholder="Pepe" defaultValue={sent?.name} />
                </label>
              </>
            )}
            {isCustomSymbol && category === "stock" && (
              <>
                <label className="field">
                  <span>
                    {labels.stock_custom_ticker}
                    <Req />
                  </span>
                  <input
                    name="symbol"
                    placeholder={labels.ph_stock_symbol}
                    autoCapitalize="characters"
                    required
                    aria-required="true"
                    defaultValue={sent?.symbol}
                  />
                </label>
                <label className="field">
                  {labels.unit_name}
                  <input name="name" placeholder="Oracle" defaultValue={sent?.name} />
                </label>
              </>
            )}

            {/* The first purchase on the same screen: a new holding is one
                save, not an empty page to fill in afterwards. */}
            <div className="form-step">
              <h3 className="form-step__title">{labels.holding_first_title}</h3>
              <p className="form-step__hint">{labels.holding_first_hint}</p>
              {category === "metal" && (
                <div className="sm:col-span-2 unit-toggle" role="group" aria-label={labels.metal_unit_label}>
                  <input type="hidden" name="unit" value={metalUnit} />
                  {(["oz", "g"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn-chip${metalUnit === key ? " btn-chip--active" : ""}`}
                      aria-pressed={metalUnit === key}
                      onClick={() => setMetalUnit(key)}
                    >
                      {key === "g" ? labels.metal_unit_g : labels.metal_unit_oz}
                    </button>
                  ))}
                </div>
              )}
              <label className="field">
                {category === "metal"
                  ? `${labels.metal_quantity} (${metalUnit === "g" ? labels.metal_unit_g : labels.metal_unit_oz})`
                  : labels.crypto_quantity}
                <input name="quantity" type="number" inputMode="decimal" step="any" min="0" defaultValue={sent?.quantity} />
              </label>
              <label className="field">
                {category === "metal"
                  ? labels.metal_unit_price_generic.replace(
                      "{unit}",
                      metalUnit === "g" ? labels.metal_unit_g : labels.metal_unit_oz,
                    )
                  : category === "stock"
                    ? labels.stock_unit_price
                    : labels.crypto_unit_price}
                <input name="unitPrice" type="number" inputMode="decimal" step="any" min="0" defaultValue={sent?.unitPrice} />
              </label>
              <label className="field">
                {labels.trade_date_buy}
                <input name="tradedAt" type="date" max={todayKey()} defaultValue={sent?.tradedAt ?? todayKey()} />
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>
                {labels.unit_name}
                <Req />
              </span>
              <input name="name" required aria-required="true" defaultValue={val("name")} />
            </label>
            <label className="field">
              {labels.unit_type}
              <select name="type" defaultValue={val("type")}>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>

            {category === "vehicle" && (
              <label className="field">
                {labels.asset_plate}
                <input
                  name="plateNumber"
                  placeholder="AA-123-BB"
                  autoCapitalize="characters"
                  autoComplete="off"
                  defaultValue={val("plateNumber")}
                />
                <span className="hint">{labels.asset_plate_hint}</span>
              </label>
            )}

            {category === "income_source" ? (
              <input type="hidden" name="status" value="personal_use" />
            ) : (
              <label className="field">
                <span>
                  {labels.status_label}
                  <Req />
                </span>
                <select
                  name="status"
                  value={status}
                  required
                  aria-required="true"
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}

            {rentable && rentalModeField}
            {dailyPricingFields}

            {category === "real_estate" && (
              <label className="field">
                {labels.unit_district}
                <input name="district" list="asset-district-options" defaultValue={val("district")} />
                <datalist id="asset-district-options">
                  {districts.map((district) => (
                    <option key={district} value={district} />
                  ))}
                </datalist>
                <span className="hint">{labels.asset_district_hint}</span>
              </label>
            )}

            {category === "income_source" ? (
              <>
                <label className="field">
                  {labels.income_monthly}
                  <input name="monthlyIncome" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={val("monthlyIncome")} />
                </label>
                <span className="hint sm:col-span-2">{labels.income_source_hint}</span>
              </>
            ) : (
              <label className="field">
                {labels.asset_value}
                <input name="estimatedValue" type="number" inputMode="decimal" min={0} step="1" defaultValue={val("estimatedValue")} />
              </label>
            )}

            {/* ── The tenant and the rent, in the same save. ── */}
            {tenantStep && (
              <div className="form-step">
                <h3 className="form-step__title">
                  {category === "vehicle" ? labels.tenant_step_title_car : labels.tenant_step_title}
                </h3>
                <label className="field sm:col-span-2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={withTenant}
                    onChange={(event) => setWithTenant(event.target.checked)}
                  />
                  {labels.tenant_step_now}
                </label>
                {withTenant ? (
                  <>
                    <input type="hidden" name="tenantStep" value="1" />
                    <ContractFields
                      compact
                      suggestDates
                      labels={
                        category === "vehicle"
                          ? { ...labels, contract_tenant: labels.contract_driver, tenant_phone: labels.driver_phone }
                          : labels
                      }
                      initial={
                        sent
                          ? {
                              tenantName: sent.tenantName,
                              tenantPhone: sent.tenantPhone,
                              paymentPeriod: sent.paymentPeriod,
                              amount: sent.amount,
                              startDate: sent.startDate,
                              endDate: sent.endDate,
                              paidThrough: sent.paidThrough,
                            }
                          : undefined
                      }
                    />
                  </>
                ) : (
                  <p className="form-step__hint sm:col-span-2" style={{ margin: 0 }}>{labels.tenant_step_later}</p>
                )}
              </div>
            )}

            {/* ── The rest waits here. ── */}
            <details className="form-fold" open={hasExtra}>
              <summary>
                {labels.form_more}
                <span className="form-fold__hint">
                  {category === "real_estate" ? labels.form_more_hint_flat : labels.form_more_hint}
                </span>
              </summary>
              <div className="form-fold__body">
                <label className="field">
                  {labels.asset_name_ka}
                  <input name="nameKa" defaultValue={val("nameKa")} />
                </label>

                {category === "real_estate" && (
                  <>
                    <label className="field">
                      {labels.unit_city}
                      <input name="city" list="asset-city-options" defaultValue={val("city") ?? cities[0]} />
                      <datalist id="asset-city-options">
                        {cities.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field sm:col-span-2">
                      {labels.unit_address}
                      <input name="address" defaultValue={val("address")} />
                    </label>
                    <label className="field">
                      {labels.asset_area}
                      <input name="areaSqm" type="number" inputMode="decimal" min={0} step="0.1" defaultValue={val("areaSqm")} />
                    </label>
                    <label className="field">
                      {labels.asset_link_unit}
                      <select name="unitId" defaultValue={val("unitId") ?? ""}>
                        <option value="">{labels.asset_none}</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>{unit.label}</option>
                        ))}
                      </select>
                      <span className="hint">
                        {rentalMode === "daily" && !asset?.unitId ? labels.asset_unit_auto : labels.asset_link_unit_hint}
                      </span>
                    </label>
                    {/* Channel calendars live on the flat's unit (made for it
                        when needed), so its bookings show in Rentals. The
                        textarea says which unit its links were shown for:
                        only that unit's list is replaced on save. */}
                    <label className="field sm:col-span-2">
                      {labels.unit_ical_urls}
                      <input type="hidden" name="icalUnitId" value={asset?.unitId ?? ""} />
                      <input type="hidden" name="icalShown" value={asset?.icalUrls ?? ""} />
                      <textarea
                        name="icalUrls"
                        rows={2}
                        defaultValue={val("icalUrls")}
                        className="font-mono text-xs"
                      />
                      <span className="hint">{labels.asset_ical_hint}</span>
                    </label>
                    <ListingInput initial={initialLinks} labels={labels} />
                  </>
                )}

                {category === "vehicle" && (
                  <ListingInput initial={initialLinks} labels={labels} />
                )}

                <label className="field sm:col-span-2">
                  {labels.asset_notes}
                  <textarea name="notes" rows={2} defaultValue={val("notes")} />
                </label>
              </div>
            </details>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {labels.save}
          </button>
          <Link href="/assets" className="link">
            {labels.cancel}
          </Link>
          <FormMessage
            error={state?.error ? labels[state.error] ?? state.error : null}
            detail={state?.error ? state.detail : null}
          />
        </div>
      </form>

      {/* Deleting sits apart from saving, named, and asks in the page. */}
      {asset?.id && (
        <div className="danger-zone">
          <ConfirmAction
            action={deleteAsset}
            fields={{ assetId: asset.id }}
            trigger={
              <>
                <IconTrash size={15} /> {labels.asset_delete_named.replace("{name}", displayName ?? asset.name)}
              </>
            }
            triggerClassName="btn-danger btn-compact icon-text"
            question={labels.asset_delete_q.replace("{name}", displayName ?? asset.name)}
            confirmLabel={labels.delete}
            cancelLabel={labels.cancel}
          />
        </div>
      )}
    </>
  );
}
