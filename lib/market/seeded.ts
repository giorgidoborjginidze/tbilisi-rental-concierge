// The built-in estimates (MarketBenchmark, RentBenchmark) are stored per
// month of the year they were made for. When the asked month has none —
// a later year, before anyone enters fresh figures — the same calendar
// month of the latest year that has one stands in, so a seasonal estimate
// degrades into last year's season instead of disappearing.

import { prisma } from "@/lib/db";

type Kind = "market" | "rent";

const sameMonthOfYear = (month: string) => month.slice(4); // "-07"

async function findOne(kind: Kind, district: string, month: string) {
  const exact = { where: { district_month: { district, month } } };
  const fallback = {
    where: { district, month: { endsWith: sameMonthOfYear(month) } },
    orderBy: { month: "desc" as const },
  };
  if (kind === "market") {
    return (
      (await prisma.marketBenchmark.findUnique(exact).catch(() => null)) ??
      (await prisma.marketBenchmark.findFirst(fallback).catch(() => null))
    );
  }
  return (
    (await prisma.rentBenchmark.findUnique(exact).catch(() => null)) ??
    (await prisma.rentBenchmark.findFirst(fallback).catch(() => null))
  );
}

export const seededMarketBenchmark = (district: string, month: string) =>
  findOne("market", district, month) as ReturnType<typeof prisma.marketBenchmark.findUnique>;
export const seededRentBenchmark = (district: string, month: string) =>
  findOne("rent", district, month) as ReturnType<typeof prisma.rentBenchmark.findUnique>;

/** Many districts at once: the asked month, else that month's latest year. */
export async function seededMany<K extends Kind>(
  kind: K,
  districts: string[],
  month: string,
): Promise<Map<string, K extends "market" ? { adr: number; occupancyRate: number } : { avgRentPerSqm: number }>> {
  const where = { district: { in: districts }, month: { endsWith: sameMonthOfYear(month) } };
  const rows =
    kind === "market"
      ? await prisma.marketBenchmark.findMany({ where, orderBy: { month: "desc" } }).catch(() => [])
      : await prisma.rentBenchmark.findMany({ where, orderBy: { month: "desc" } }).catch(() => []);
  const out = new Map();
  // Newest year first; the asked month itself wins over any other year.
  for (const row of rows as { district: string; month: string }[]) {
    if (!out.has(row.district) || row.month === month) out.set(row.district, row);
  }
  return out;
}
