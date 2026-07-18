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
