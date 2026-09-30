import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_TYPES,
} from "@/lib/types";
import { COINS } from "@/lib/crypto/prices";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import { METALS } from "@/lib/metals/prices";
import { prisma } from "@/lib/db";
import { cityOptions, districtOptions } from "@/lib/places";
import { CONTRACT_LABEL_KEYS } from "./contract-labels";

// Everything an AssetForm (client component) needs, resolved server-side.
export async function assetFormProps(
  locale: Locale,
  operatorId: string,
  currentAssetId?: string,
) {
  const labelKeys: StringKey[] = [
    "unit_name", "unit_city", "unit_district", "unit_address",
    "unit_type", "asset_category", "status_label", "asset_area", "asset_value",
    "asset_notes", "asset_link_unit", "asset_none",
    "listing_links", "listing_add", "listing_unknown", "listing_hint", "aria_remove_link",
    "rental_mode", "mode_long_term", "mode_daily",
    "daily_rate", "weekend_pct", "holiday_pct", "daily_pricing_hint",
    "income_monthly", "income_source_hint",
    "save", "cancel", "delete", "error_required", "error_invalid_number",
    "error_email_taken", "error_dates",
    "crypto_coin", "crypto_custom", "crypto_custom_symbol", "crypto_custom_id",
    "crypto_custom_id_hint", "stock_ticker",
    "stock_custom_ticker", "metal_type",
    "ph_crypto_symbol", "ph_crypto_id", "ph_stock_symbol",
    "unit_ical_urls", "asset_ical_hint", "asset_unit_auto", "error_ical_url",
    "error_limit_units", "error_limit_assets", "error_demo_readonly",
    // One form that helps: required marks, the "more details" fold, the
    // tenant step, a car's plate, a holding's first purchase.
    "form_required_legend", "form_more", "form_more_hint", "form_more_hint_flat",
    "asset_name_ka", "asset_district_hint", "asset_link_unit_hint",
    "asset_plate", "asset_plate_hint", "asset_delete_named", "asset_delete_q",
    "tenant_step_title", "tenant_step_title_car", "tenant_step_now", "tenant_step_later",
    "contract_driver", "driver_phone",
    "holding_first_title", "holding_first_hint", "crypto_quantity", "crypto_unit_price",
    "stock_unit_price", "metal_quantity", "metal_unit_price_generic", "metal_unit_oz",
    "metal_unit_g", "metal_unit_label", "trade_date_buy",
    ...CONTRACT_LABEL_KEYS,
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  const typesByCategory = Object.fromEntries(
    Object.entries(ASSET_TYPES).map(([category, types]) => [
      category,
      types.map((value) => ({
        value,
        label: t(locale, `type_${value}` as StringKey),
      })),
    ]),
  );

  // Units available for linking: not linked to another asset.
  const units = await prisma.unit.findMany({
    where: {
      operatorId,
      OR: [
        { asset: null },
        ...(currentAssetId ? [{ asset: { id: currentAssetId } }] : []),
      ],
    },
    select: { id: true, name: true, nameKa: true },
    orderBy: { name: "asc" },
  });

  return {
    labels,
    typesByCategory,
    // One form for everything — including crypto/stock/metal holdings.
    categories: ASSET_CATEGORIES.map((value) => ({
      value,
      label: t(locale, `category_${value}` as StringKey),
    })),
    statuses: ASSET_STATUSES.map((value) => ({
      value,
      label: t(locale, `status_${value}` as StringKey),
    })),
    // Suggestions in the owner's language; saving stores the key
    // ("ვაკე" → "Vake"), which the market benchmarks are keyed by.
    districts: districtOptions(locale),
    cities: cityOptions(locale),
    units: units.map((unit) => ({
      id: unit.id,
      label: locale === "ka" && unit.nameKa ? unit.nameKa : unit.name,
    })),
    // Holding pickers (crypto coins, US stocks, precious metals).
    coins: Object.entries(COINS).map(([symbol, c]) => ({ symbol, name: c.name })),
    stocks: Object.entries(POPULAR_STOCKS).map(([symbol, name]) => ({ symbol, name })),
    metals: Object.entries(METALS).map(([symbol, m]) => ({ symbol, name: m.name })),
  };
}
