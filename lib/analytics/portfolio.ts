// Nightly metrics across places priced in different currencies. A flat let
// in dollars and one in lari cannot be added as they stand: when the places
// do not share one currency, each place's money figures (revenue, ADR,
// RevPAR) are put in lari at today's National Bank rate before they are
// added up, and the caller marks the totals as approximate. Nights and
// rates are counts, never converted.

import { loadGelRates } from "@/lib/fx/gel-rates";
import { asCurrency, gelPer, type Currency, type GelRates } from "@/lib/fx/convert";
import { placeMetrics, type PlaceSources } from "@/lib/property/stays";
import type { WindowMetrics } from "./metrics";

/** One place's money figures multiplied by `factor` (GEL per its currency). */
export function scaledMetrics(m: WindowMetrics, factor: number): WindowMetrics {
  if (factor === 1) return m;
  return {
    ...m,
    revenue: m.revenue * factor,
    adr: m.adr == null ? null : m.adr * factor,
    revpar: m.revpar == null ? null : m.revpar * factor,
  };
}

/** The currency totals are shown in: the places' own, or lari when mixed. */
export function portfolioCurrency(places: { currency: string | null }[]): { currency: Currency; mixed: boolean } {
  const all = new Set(places.map((place) => asCurrency(place.currency)));
  if (all.size > 1) return { currency: "GEL", mixed: true };
  return { currency: all.values().next().value ?? "GEL", mixed: false };
}

export interface PortfolioPricing {
  currency: Currency;
  /** Places in more than one currency: totals converted, approximate. */
  mixed: boolean;
  /** A place's metrics for the window, in `currency`. */
  metricsOf: (place: { sources: PlaceSources; currency: string | null }, window: { start: Date; end: Date }) => WindowMetrics;
}

export function portfolioPricingWith(places: { currency: string | null }[], rates: GelRates | null): PortfolioPricing {
  const { currency, mixed } = portfolioCurrency(places);
  return {
    currency,
    mixed,
    metricsOf: (place, window) => {
      const metrics = placeMetrics(place.sources, window);
      return mixed && rates ? scaledMetrics(metrics, gelPer(place.currency, rates)) : metrics;
    },
  };
}

/** Loads the rate only when it is needed (places in more than one currency). */
export async function portfolioPricing(places: { currency: string | null }[]): Promise<PortfolioPricing> {
  const rates = portfolioCurrency(places).mixed ? await loadGelRates() : null;
  return portfolioPricingWith(places, rates);
}
