// Loads what an operator earned from, for lib/analytics/income.ts to count.
// Every income figure on a page comes through here, so the dashboard hero,
// the KPIs, the income bars and the /assets total are one number.

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

export type { IncomeBreakdown } from "./income";

/** Everything that can earn money inside [from, to). */
export async function loadIncomeSources(
  operatorId: string,
  range: IncomeWindow,
): Promise<IncomeSources> {
  const { start: from, end: to } = range;
  const [assets, contracts, leases, bookings, dayEntries, records] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId },
      select: {
        id: true,
        unitId: true,
        category: true,
        rentalMode: true,
        monthlyIncome: true,
        createdAt: true,
        weekendPct: true,
        holidayPct: true,
      },
    }),
    prisma.rentalContract.findMany({
      where: { asset: { operatorId }, startDate: { lt: to }, endDate: { gt: from }, ...LIVE_CONTRACT },
      select: {
        assetId: true,
        startDate: true,
        endDate: true,
        paymentPeriod: true,
        paymentAmount: true,
        monthlyRent: true,
      },
    }),
    prisma.lease.findMany({
      where: { unit: { operatorId }, startDate: { lt: to }, endDate: { gt: from } },
      select: { unitId: true, startDate: true, endDate: true, monthlyRent: true },
    }),
    prisma.booking.findMany({
      where: {
        ...LIVE_STAY,
        checkIn: { lt: to },
        checkOut: { gt: from },
        unit: { operatorId },
      },
      select: { unitId: true, checkIn: true, checkOut: true, nights: true, amount: true },
    }),
    prisma.dayEntry.findMany({
      where: { asset: { operatorId }, rented: true, date: { gte: from, lt: to } },
      select: { assetId: true, date: true, amount: true },
    }),
    prisma.incomeRecord.findMany({
      where: { operatorId, date: { gte: from, lt: to } },
      select: { date: true, amount: true },
    }),
  ]);
  return { assets, contracts, leases, bookings, dayEntries, records };
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
  return incomeInWindow(await loadIncomeSources(operatorId, window), window);
}

/** Income of `count` consecutive months from `first`, one query round. */
export async function monthlyIncomeSeries(
  operatorId: string,
  first: Date,
  count: number,
): Promise<{ start: Date; income: IncomeBreakdown }[]> {
  const windows = monthWindowsFrom(first, count);
  const sources = await loadIncomeSources(operatorId, {
    start: windows[0].start,
    end: windows[windows.length - 1].end,
  });
  return windows.map((window) => ({
    start: window.start,
    income: incomeInWindow(sources, window),
  }));
}
