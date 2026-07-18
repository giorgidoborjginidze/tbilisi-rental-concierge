import { t, type Locale } from "@/lib/i18n/strings";
import { CITIES, KNOWN_DISTRICTS, UNIT_TYPES } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";

// Everything a UnitForm (client component) needs, resolved server-side.
export function unitFormProps(locale: Locale) {
  const labelKeys: StringKey[] = [
    "unit_name", "unit_name_ka", "unit_city", "unit_district", "unit_address",
    "unit_type", "unit_capacity", "unit_bedrooms", "unit_base_rate",
    "unit_currency", "unit_amenities", "unit_airbnb_url", "unit_booking_url",
    "unit_ical_urls", "unit_ical_hint", "save", "cancel", "delete",
    "delete_confirm", "error_required", "error_invalid_number",
    "error_email_taken",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return {
    labels,
    cities: CITIES,
    districts: KNOWN_DISTRICTS,
    types: UNIT_TYPES.map((value) => ({
      value,
      label: t(locale, `type_${value}` as StringKey),
    })),
  };
}
