// Shared domain types kept framework-free so Phase 2 can reuse them.

export interface ChannelLinks {
  airbnbUrl?: string | null;
  bookingUrl?: string | null;
  icalUrls: string[];
}

export const UNIT_TYPES = [
  "apartment",
  "studio",
  "aparthotel_room",
  "house",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const CITIES = ["Tbilisi", "Batumi"] as const;

export const KNOWN_DISTRICTS = [
  "Vake",
  "Vera",
  "Saburtalo",
  "Old Town",
  "Mtatsminda",
  "Batumi Boulevard",
] as const;

export const BOOKING_SOURCES = ["airbnb", "booking", "direct", "manual"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const ASSET_CATEGORIES = ["real_estate", "vehicle", "other"] as const;

export const ASSET_TYPES: Record<string, readonly string[]> = {
  real_estate: ["apartment", "house", "commercial", "land", "garage"],
  vehicle: ["car", "motorcycle", "truck"],
  other: ["equipment", "other"],
};

export const ASSET_STATUSES = [
  "rented",
  "vacant",
  "personal_use",
  "listed",
] as const;

export const INCOME_SOURCES = [
  "rent",
  "str",
  "salary",
  "business",
  "dividend",
  "other",
] as const;

export function parseChannelLinks(value: unknown): ChannelLinks {
  const raw = (value ?? {}) as Partial<ChannelLinks>;
  return {
    airbnbUrl: raw.airbnbUrl ?? null,
    bookingUrl: raw.bookingUrl ?? null,
    icalUrls: Array.isArray(raw.icalUrls) ? raw.icalUrls : [],
  };
}

export function parseAmenities(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
