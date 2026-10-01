// Month-by-month demand profiles for Georgian STR markets.
// Shared by the pricing engine and the seed script.

export const TBILISI_SEASONALITY: Record<number, number> = {
  1: 0.85, 2: 0.8, 3: 0.9, 4: 1.0, 5: 1.05, 6: 1.1,
  7: 1.2, 8: 1.25, 9: 1.1, 10: 1.0, 11: 0.85, 12: 1.05,
};

// Batumi is a summer resort: strong July/August peak, quiet winters.
export const BATUMI_SEASONALITY: Record<number, number> = {
  1: 0.6, 2: 0.6, 3: 0.7, 4: 0.85, 5: 1.0, 6: 1.3,
  7: 1.6, 8: 1.65, 9: 1.2, 10: 0.9, 11: 0.65, 12: 0.75,
};

export function seasonalityFactor(city: string, month: number): number {
  const profile = city === "Batumi" ? BATUMI_SEASONALITY : TBILISI_SEASONALITY;
  return profile[month] ?? 1.0;
}

/** Days on each side of a month boundary over which two months' factors blend. */
export const SEASON_BLEND_DAYS = 7;

/**
 * The season factor of one day, blended across month boundaries: within a
 * week of the 1st it moves linearly from the old month's factor to the new
 * one's, so the price does not fall off a cliff overnight (Batumi 30 Sep
 * 162 → 1 Oct 122 became a slope).
 */
export function seasonalityOn(city: string, date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based
  const day = date.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const own = seasonalityFactor(city, month + 1);
  // Nights before/after the nearest boundary (the boundary sits between the
  // last night of a month and the first of the next).
  if (day <= SEASON_BLEND_DAYS) {
    const prev = seasonalityFactor(city, ((month + 11) % 12) + 1);
    const w = 0.5 + (day - 0.5) / (2 * SEASON_BLEND_DAYS);
    return Math.round((prev * (1 - w) + own * w) * 1000) / 1000;
  }
  if (day > daysInMonth - SEASON_BLEND_DAYS) {
    const next = seasonalityFactor(city, ((month + 1) % 12) + 1);
    const w = 0.5 - (daysInMonth - day + 0.5) / (2 * SEASON_BLEND_DAYS);
    return Math.round((own * (1 - w) + next * w) * 1000) / 1000;
  }
  return own;
}
