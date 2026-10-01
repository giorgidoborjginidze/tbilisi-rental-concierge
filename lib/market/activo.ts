// Source three: what Activo's customers' own records say about the market,
// as anonymous district averages. Once a day (lib/automation/run.ts):
//
//   rent_sqm  — running long-term contracts on flats with an area: the
//               monthly rent per m² (in lari at the NBG rate);
//   adr       — direct and channel stays of the last 90 days with a price:
//               the average night;
//   occupancy — those stays' nights over the units' nights.
//
// A figure is published only when it rests on at least MIN_SAMPLE records
// from at least MIN_WORKSPACES different workspaces, so no single owner's
// rent can be read out of it; only the district aggregate is stored. The
// demo account is left out. The Privacy Policy says so.

import { prisma } from "@/lib/db";
import { districtKey } from "@/lib/places";
import { monthKeyTbilisi, startOfTodayTbilisi } from "@/lib/time";
import { toGel, type GelRates } from "@/lib/fx/convert";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { trimmedMedian, type MarketMetric } from "./blend";

export const MIN_SAMPLE = 5;
export const MIN_WORKSPACES = 3;
const WINDOW_DAYS = 90;
const DAY = 86_400_000;

export interface Observation {
  district: string;
  operatorId: string;
  value: number;
  /** For occupancy: the nights this observation stands for (its weight). */
  weight?: number;
}

export interface ActivoFigure {
  district: string;
  metric: MarketMetric;
  value: number;
  sampleSize: number;
}

/** District aggregates that pass the anonymity rule. Pure. */
export function aggregate(metric: MarketMetric, observations: Observation[]): ActivoFigure[] {
  const byDistrict = new Map<string, Observation[]>();
  for (const obs of observations) {
    const key = districtKey(obs.district);
    if (!key || !(obs.value >= 0) || !Number.isFinite(obs.value)) continue;
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), obs]);
  }
  const out: ActivoFigure[] = [];
  for (const [district, list] of byDistrict) {
    const workspaces = new Set(list.map((obs) => obs.operatorId)).size;
    if (list.length < MIN_SAMPLE || workspaces < MIN_WORKSPACES) continue;
    const value =
      metric === "occupancy"
        ? list.reduce((sum, obs) => sum + obs.value * (obs.weight ?? 1), 0) / list.reduce((sum, obs) => sum + (obs.weight ?? 1), 0)
        : trimmedMedian(list.map((obs) => obs.value));
    if (value == null || !Number.isFinite(value)) continue;
    out.push({ district, metric, value: Math.round(value * 100) / 100, sampleSize: list.length });
  }
  return out;
}

async function rentObservations(today: Date, rates: GelRates): Promise<Observation[]> {
  const contracts = await prisma.rentalContract.findMany({
    where: {
      deletedAt: null,
      startDate: { lte: today },
      endDate: { gt: today },
      paymentPeriod: { in: ["monthly", "weekly"] },
      asset: { category: "real_estate", areaSqm: { gt: 10 }, district: { not: null }, operator: { isDemo: false } },
    },
    select: { monthlyRent: true, currency: true, asset: { select: { district: true, areaSqm: true, operatorId: true } } },
  });
  return contracts.map((c) => ({
    district: c.asset.district ?? "",
    operatorId: c.asset.operatorId,
    value: toGel(c.monthlyRent, c.currency, rates) / (c.asset.areaSqm ?? 1),
  }));
}

async function stayObservations(today: Date, rates: GelRates): Promise<{ adr: Observation[]; occupancy: Observation[] }> {
  const from = new Date(today.getTime() - WINDOW_DAYS * DAY);
  const units = await prisma.unit.findMany({
    where: { district: { not: "" }, createdAt: { lte: from }, operator: { isDemo: false } },
    select: {
      id: true,
      district: true,
      operatorId: true,
      bookings: {
        where: { status: { not: "cancelled" }, mirrorOf: null, checkOut: { gt: from }, checkIn: { lt: today } },
        select: { checkIn: true, checkOut: true, nights: true, amount: true, currency: true },
      },
    },
  });
  const adr: Observation[] = [];
  const occupancy: Observation[] = [];
  for (const unit of units) {
    let nights = 0;
    for (const stay of unit.bookings) {
      const start = Math.max(stay.checkIn.getTime(), from.getTime());
      const end = Math.min(stay.checkOut.getTime(), today.getTime());
      nights += Math.max(0, Math.round((end - start) / DAY));
      if (stay.amount != null && stay.nights > 0) {
        adr.push({ district: unit.district, operatorId: unit.operatorId, value: toGel(stay.amount, stay.currency, rates) / stay.nights });
      }
    }
    // A unit with no stay at all may simply not be used here: it does not count as empty.
    if (unit.bookings.length > 0) {
      occupancy.push({ district: unit.district, operatorId: unit.operatorId, value: Math.min(1, nights / WINDOW_DAYS), weight: WINDOW_DAYS });
    }
  }
  return { adr, occupancy };
}

/** Recomputes this month's Activo figures and stores them; returns how many were published. */
export async function refreshActivoFigures(now: Date = new Date()): Promise<number> {
  const today = startOfTodayTbilisi(now);
  const period = monthKeyTbilisi(now);
  const rates = await loadGelRates();
  const stays = await stayObservations(today, rates);
  const figures = [
    ...aggregate("rent_sqm", await rentObservations(today, rates)),
    ...aggregate("adr", stays.adr),
    ...aggregate("occupancy", stays.occupancy),
  ];
  // This month's figures are replaced as a whole: a district that no
  // longer passes the anonymity rule loses its figure.
  await prisma.$transaction([
    prisma.marketFigure.deleteMany({ where: { source: "activo", period } }),
    ...figures.map((figure) =>
      prisma.marketFigure.create({
        data: { ...figure, period, source: "activo", sourceName: "" },
      }),
    ),
  ]);
  return figures.length;
}
