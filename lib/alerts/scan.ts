// Alert scan job: vacancy gaps, expiring leases, and underpriced units.
// Each alert carries a structured payload plus a stable `key` used to
// dedupe against already-open alerts, so re-running the scan never spams.
// Suggested-action text is rendered localized in the UI from `type`.

import { prisma } from "@/lib/db";
import { findGaps, type Stay } from "@/lib/calendar/occupancy";
import { suggestRate } from "@/lib/pricing/engine";
import { getMarketDataSource } from "@/lib/market/source";

const DAY_MS = 86_400_000;
const GAP_WINDOW_DAYS = 30;
const GAP_MIN_NIGHTS = 2;
const LEASE_EXPIRY_DAYS = 30;

export interface ScanResult {
  created: number;
  skipped: number; // already-open duplicates
}

const dayStamp = (date: Date) => date.toISOString().slice(0, 10);

export async function scanAlerts(
  today = new Date(),
  operatorId?: string,
): Promise<ScanResult> {
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const gapWindowEnd = new Date(start.getTime() + GAP_WINDOW_DAYS * DAY_MS);
  const leaseWindowEnd = new Date(start.getTime() + LEASE_EXPIRY_DAYS * DAY_MS);
  const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  const units = await prisma.unit.findMany({
    where: operatorId ? { operatorId } : undefined,
    include: {
      bookings: {
        where: {
          status: { not: "cancelled" },
          checkIn: { lt: gapWindowEnd },
          checkOut: { gt: start },
        },
      },
      leases: true,
    },
  });

  // Dedupe against every existing alert regardless of status — a dismissed
  // or resolved alert must not reappear on the next scan.
  const existingAlerts = await prisma.alert.findMany({
    where: operatorId ? { operatorId } : undefined,
  });
  const openKeys = new Set(
    existingAlerts.map((alert) => {
      const payload = alert.payload as { key?: string };
      return `${alert.type}|${alert.unitId ?? ""}|${payload.key ?? ""}`;
    }),
  );

  const market = getMarketDataSource();
  const result: ScanResult = { created: 0, skipped: 0 };

  const push = async (
    operatorId: string,
    unitId: string | null,
    type: string,
    key: string,
    payload: Record<string, unknown>,
  ) => {
    const dedupeKey = `${type}|${unitId ?? ""}|${key}`;
    if (openKeys.has(dedupeKey)) {
      result.skipped += 1;
      return;
    }
    await prisma.alert.create({
      data: { operatorId, unitId, type, payload: { key, ...payload } },
    });
    openKeys.add(dedupeKey);
    result.created += 1;
  };

  for (const unit of units) {
    // 1. Vacancy gaps in the next 30 days (leases count as occupancy).
    const stays: Stay[] = [
      ...unit.bookings.map((b) => ({
        id: b.id,
        kind: b.source,
        start: b.checkIn,
        end: b.checkOut,
      })),
      ...unit.leases.map((l) => ({
        id: l.id,
        kind: "lease",
        start: l.startDate,
        end: l.endDate,
      })),
    ];
    const gaps = findGaps(stays, { start, end: gapWindowEnd }, GAP_MIN_NIGHTS);
    for (const gap of gaps) {
      await push(unit.operatorId, unit.id, "vacancy_gap", dayStamp(gap.start), {
        start: dayStamp(gap.start),
        end: dayStamp(gap.end),
        nights: gap.nights,
      });
    }

    // 2. Active leases expiring within N days.
    for (const lease of unit.leases) {
      if (
        lease.status === "active" &&
        lease.endDate >= start &&
        lease.endDate <= leaseWindowEnd
      ) {
        await push(unit.operatorId, unit.id, "lease_expiry", lease.id, {
          leaseId: lease.id,
          endDate: dayStamp(lease.endDate),
          tenantName: lease.tenantName,
          daysLeft: Math.round((lease.endDate.getTime() - start.getTime()) / DAY_MS),
        });
      }
    }

    // 3. Underpriced vs the district benchmark (this month).
    const occupiedNights = new Set<number>();
    for (const booking of unit.bookings) {
      for (
        let t = Math.max(booking.checkIn.getTime(), start.getTime());
        t < Math.min(booking.checkOut.getTime(), gapWindowEnd.getTime());
        t += DAY_MS
      ) {
        occupiedNights.add(t);
      }
    }
    const benchmark = await market.getBenchmark(unit.district, month);
    const pricing = suggestRate({
      baseNightlyRate: unit.baseNightlyRate,
      city: unit.city,
      date: start,
      upcomingOccupancy: occupiedNights.size / GAP_WINDOW_DAYS,
      benchmarkAdr: benchmark?.adr ?? null,
    });
    if (pricing.underpriced && benchmark) {
      await push(unit.operatorId, unit.id, "underpriced", month, {
        month,
        district: unit.district,
        benchmarkAdr: benchmark.adr,
        suggestedRate: pricing.suggestedRate,
        baseNightlyRate: unit.baseNightlyRate,
      });
    }
  }

  // 4. Asset rental contracts expiring within N days.
  const expiringContracts = await prisma.rentalContract.findMany({
    where: {
      status: "active",
      endDate: { gte: start, lte: leaseWindowEnd },
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    include: { asset: true },
  });
  for (const contract of expiringContracts) {
    await push(contract.asset.operatorId, null, "contract_expiry", contract.id, {
      contractId: contract.id,
      assetId: contract.assetId,
      assetName: contract.asset.name,
      endDate: dayStamp(contract.endDate),
      tenantName: contract.tenantName,
      monthlyRent: contract.monthlyRent,
      daysLeft: Math.round(
        (contract.endDate.getTime() - start.getTime()) / DAY_MS,
      ),
    });
  }

  return result;
}
