import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_TYPES,
  KNOWN_DISTRICTS,
} from "@/lib/types";
import { COINS } from "@/lib/crypto/prices";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import { METALS } from "@/lib/metals/prices";
import { prisma } from "@/lib/db";

// Everything an AssetForm (client component) needs, resolved server-side.
export async function assetFormProps(
  locale: Locale,
  operatorId: string,
  currentAssetId?: string,
) {
  const labelKeys: StringKey[] = [
    "unit_name", "unit_name_ka", "unit_city", "unit_district", "unit_address",
    "unit_type", "asset_category", "status_label", "asset_area", "asset_value",
    "asset_notes", "asset_link_unit", "asset_none", "asset_delete_confirm",
    "listing_links", "listing_add", "listing_unknown", "listing_hint",
    "rental_mode", "mode_long_term", "mode_daily",
    "daily_rate", "weekend_pct", "holiday_pct", "daily_pricing_hint",
    "income_monthly", "income_source_hint",
    "save", "cancel", "delete", "error_required", "error_invalid_number",
    "error_email_taken", "error_dates",
    "crypto_coin", "crypto_custom", "crypto_custom_symbol", "crypto_custom_id",
    "crypto_custom_id_hint", "crypto_add_hint", "stock_ticker",
    "stock_custom_ticker", "stock_add_hint", "metal_type", "metal_hint",
    "holding_next_hint",
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
    select: { id: true, name: true },
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
    districts: KNOWN_DISTRICTS,
    units: units.map((unit) => ({ id: unit.id, label: unit.name })),
    // Holding pickers (crypto coins, US stocks, precious metals).
    coins: Object.entries(COINS).map(([symbol, c]) => ({ symbol, name: c.name })),
    stocks: Object.entries(POPULAR_STOCKS).map(([symbol, name]) => ({ symbol, name })),
    metals: Object.entries(METALS).map(([symbol, m]) => ({ symbol, name: m.name })),
  };
}
