// Loads what an operator earned from, for lib/analytics/income.ts to count.
// Every income figure on a page comes through here, so the dashboard hero,
// the KPIs, the income bars and the /assets total are one number.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { monthStartTbilisi } from "@/lib/time";
import {
  incomeInWindow,
  monthWindowsFrom,
  type IncomeBreakdown,
  type IncomeSources,
  type IncomeWindow,
} from "./income";
import { LIVE_STAY } from "@/lib/bookings/live";
import { overlapsWhere } from "@/lib/rentals/phase";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { anyForeign, toGel } from "@/lib/fx/convert";

export type { IncomeBreakdown } from "./income";

/** Everything that can earn money inside [from, to), every amount in lari. */
export async function loadIncomeSources(
  operatorId: string,
  range: IncomeWindow,
): Promise<IncomeSources> {
  const { start: from, end: to } = range;
  const [assets, contracts, leases, bookings, dayEntries, records, rates] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId },
      select: {
        id: true,
        unitId: true,
        category: true,
        rentalMode: true,
        monthlyIncome: true,
        currency: true,
        createdAt: true,
        weekendPct: true,
        holidayPct: true,
      },
    }),
    prisma.rentalContract.findMany({
      where: { asset: { operatorId }, ...overlapsWhere(from, to), ...LIVE_CONTRACT },
      select: {
        assetId: true,
        startDate: true,
        endDate: true,
        paymentPeriod: true,
        paymentAmount: true,
        monthlyRent: true,
        currency: true,
      },
    }),
    prisma.lease.findMany({
      where: { unit: { operatorId }, ...overlapsWhere(from, to) },
      select: { unitId: true, startDate: true, endDate: true, monthlyRent: true, currency: true },
    }),
    prisma.booking.findMany({
      where: {
        ...LIVE_STAY,
        checkIn: { lt: to },
        checkOut: { gt: from },
        unit: { operatorId },
      },
      select: { unitId: true, checkIn: true, checkOut: true, nights: true, amount: true, currency: true },
    }),
    prisma.dayEntry.findMany({
      where: { asset: { operatorId }, rented: true, date: { gte: from, lt: to } },
      select: { assetId: true, date: true, amount: true, currency: true },
    }),
    prisma.incomeRecord.findMany({
      where: { operatorId, date: { gte: from, lt: to } },
      select: { date: true, amount: true, currency: true },
    }),
    loadGelRates(),
  ]);
  // A dollar lease or a euro booking counts in lari at today's NBG rate
  // (lib/fx): the totals are one currency, the rows keep their own.
  const gel = (amount: number, currency: string) => toGel(amount, currency, rates);
  const converted = anyForeign([
    ...contracts.map((row) => row.currency),
    ...leases.map((row) => row.currency),
    ...bookings.map((row) => row.currency),
    ...dayEntries.map((row) => row.currency),
    ...records.map((row) => row.currency),
    ...assets.filter((row) => row.monthlyIncome).map((row) => row.currency),
  ]);
  const gelOrNull = (amount: number | null, currency: string) => (amount == null ? null : gel(amount, currency));
  return {
    assets: assets.map(({ currency, ...asset }) => ({
      ...asset,
      monthlyIncome: gelOrNull(asset.monthlyIncome, currency),
    })),
    contracts: contracts.map(({ currency, ...contract }) => ({
      ...contract,
      paymentAmount: gelOrNull(contract.paymentAmount, currency),
      monthlyRent: gel(contract.monthlyRent, currency),
    })),
    leases: leases.map(({ currency, ...lease }) => ({ ...lease, monthlyRent: gel(lease.monthlyRent, currency) })),
    bookings: bookings.map(({ currency, ...booking }) => ({ ...booking, amount: gelOrNull(booking.amount, currency) })),
    dayEntries: dayEntries.map(({ currency, ...day }) => ({ ...day, amount: gel(day.amount, currency) })),
    records: records.map(({ currency, ...record }) => ({ ...record, amount: gel(record.amount, currency) })),
    converted,
  };
}

/**
 * The six months the dashboard shows (this Tbilisi month and the five
 * before it), loaded once per request: the hero's "this month" and the
 * income bars read the same rows instead of querying twice.
 */
const DASHBOARD_MONTHS = 6;
const recentSources = cache((operatorId: string, firstIso: string) => {
  const windows = monthWindowsFrom(new Date(firstIso), DASHBOARD_MONTHS);
  return loadIncomeSources(operatorId, { start: windows[0].start, end: windows[windows.length - 1].end });
});

function recentFirst(): Date {
  return monthStartTbilisi(1 - DASHBOARD_MONTHS);
}

/**
 * Income of one calendar month (default: this Tbilisi month), by source.
 * `month` is any day of it.
 */
export async function monthlyIncome(
  operatorId: string,
  month: Date = monthStartTbilisi(0),
): Promise<IncomeBreakdown> {
  const [window] = monthWindowsFrom(
    new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)),
    1,
  );
  const first = recentFirst();
  const recent = window.start >= first && window.start <= monthStartTbilisi(0);
  const sources = recent
    ? await recentSources(operatorId, first.toISOString())
    : await loadIncomeSources(operatorId, window);
  return { ...incomeInWindow(sources, window), converted: sources.converted };
}

/** Income of `count` consecutive months from `first`, one query round. */
export async function monthlyIncomeSeries(
  operatorId: string,
  first: Date,
  count: number,
): Promise<{ start: Date; income: IncomeBreakdown }[]> {
  const windows = monthWindowsFrom(first, count);
  const sources =
    count === DASHBOARD_MONTHS && first.getTime() === recentFirst().getTime()
      ? await recentSources(operatorId, first.toISOString())
      : await loadIncomeSources(operatorId, {
          start: windows[0].start,
          end: windows[windows.length - 1].end,
        });
  return windows.map((window) => ({
    start: window.start,
    income: { ...incomeInWindow(sources, window), converted: sources.converted },
  }));
}
