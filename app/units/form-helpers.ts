import { t, type Locale } from "@/lib/i18n/strings";
import { CITIES, UNIT_TYPES } from "@/lib/types";
import { cityLabel, districtOptions } from "@/lib/places";
import type { StringKey } from "@/lib/i18n/strings";

// Everything a UnitForm (client component) needs, resolved server-side.
export function unitFormProps(locale: Locale) {
  const labelKeys: StringKey[] = [
    "unit_name", "unit_city", "unit_district", "unit_address",
    "unit_type", "unit_capacity", "unit_bedrooms", "unit_base_rate",
    "unit_currency", "unit_amenities", "unit_airbnb_url", "unit_booking_url",
    "unit_ical_urls", "unit_ical_hint", "save", "cancel", "delete",
    "delete_confirm", "error_required", "error_invalid_number",
    "error_email_taken", "error_ical_url", "ph_amenities",
    "unit_asset_link", "unit_asset_new", "unit_asset_none", "unit_asset_hint",
    "error_limit_units", "error_demo_readonly", "form_required_legend", "asset_name_ka",
    "form_more", "form_more_hint_unit",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return {
    labels,
    // Stored by key, shown in the owner's language.
    cities: CITIES.map((value) => ({ value, label: cityLabel(locale, value) })),
    // Suggestions in the owner's language; saving stores the key.
    districts: districtOptions(locale),
    types: UNIT_TYPES.map((value) => ({
      value,
      label: t(locale, `type_${value}` as StringKey),
    })),
  };
}

/** Real-estate assets of the workspace not linked to a unit yet. */
export async function linkableAssets(operatorId: string, locale: Locale) {
  const { prisma } = await import("@/lib/db");
  const assets = await prisma.asset.findMany({
    where: { operatorId, category: "real_estate", unitId: null },
    select: { id: true, name: true, nameKa: true },
    orderBy: { name: "asc" },
  });
  return assets.map((asset) => ({
    id: asset.id,
    label: locale === "ka" && asset.nameKa ? asset.nameKa : asset.name,
  }));
}
