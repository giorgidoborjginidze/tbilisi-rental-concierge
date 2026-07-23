import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ASSET_TYPES,
  KNOWN_DISTRICTS,
} from "@/lib/types";
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
    "myhome_url", "myhome_hint", "ss_url", "myauto_url", "unit_airbnb_url",
    "unit_booking_url", "rental_mode", "mode_long_term", "mode_daily",
    "daily_rate", "weekend_pct", "holiday_pct", "daily_pricing_hint",
    "income_monthly", "income_source_hint",
    "save", "cancel", "delete", "error_required", "error_invalid_number",
    "error_email_taken", "error_dates",
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
    // Crypto and stock have dedicated add flows (they capture a ticker and
    // wire up live pricing), so they're excluded from the generic selector.
    categories: ASSET_CATEGORIES.filter(
      (value) => value !== "crypto" && value !== "stock",
    ).map((value) => ({
      value,
      label: t(locale, `category_${value}` as StringKey),
    })),
    statuses: ASSET_STATUSES.map((value) => ({
      value,
      label: t(locale, `status_${value}` as StringKey),
    })),
    districts: KNOWN_DISTRICTS,
    units: units.map((unit) => ({ id: unit.id, label: unit.name })),
  };
}
