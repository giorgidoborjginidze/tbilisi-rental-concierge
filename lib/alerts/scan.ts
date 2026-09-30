// Alert scan job: vacancy gaps, expiring leases, underpriced units,
// finished contracts, silent GPS trackers and late rent.
// Each alert carries a structured payload plus a stable `key` used to
// dedupe against already-open alerts, so re-running the scan never spams.
// Suggested-action text is rendered localized in the UI from `type`.

import { prisma } from "@/lib/db";
import { findGaps, type Stay } from "@/lib/calendar/occupancy";
import { suggestRate } from "@/lib/pricing/engine";
import { getMarketDataSource } from "@/lib/market/source";
import { monitorRentPayments } from "@/lib/rentals/monitor";
import {
  activeContractWhere,
  contractPhase,
  endedContractToFollowUp,
  recentlyEndedWhere,
} from "@/lib/rentals/phase";
import { hasBalance } from "@/lib/rentals/terms";
import { closeSupersededEndings } from "@/lib/rentals/settle";
import { isTrackerSilent, silenceKey, TRACKER_SILENT_MINUTES } from "@/lib/geo/silence";
import { dayKey, startOfTodayTbilisi } from "@/lib/time";

const DAY_MS = 86_400_000;
const GAP_WINDOW_DAYS = 30;
const GAP_MIN_NIGHTS = 2;
const LEASE_EXPIRY_DAYS = 30;
/** How far back a finished contract still earns a "contract ended" alert. */
const CONTRACT_ENDED_DAYS = 60;

export interface ScanResult {
  created: number;
  skipped: number; // already-open duplicates
}

const dayStamp = dayKey;

export async function scanAlerts(
  now = new Date(),
  operatorId?: string,
): Promise<ScanResult> {
  // Tbilisi's today, in the stored form of a calendar day.
  const start = startOfTodayTbilisi(now);
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

    // 2. Running leases (by their dates) expiring within N days.
    for (const lease of unit.leases) {
      if (
        contractPhase(lease, start) === "active" &&
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

  // 4. Asset rental contracts running today and expiring within N days —
  //    by their dates, whatever status was stored when they were typed in.
  const running = activeContractWhere(start);
  const expiringContracts = await prisma.rentalContract.findMany({
    where: {
      startDate: running.startDate,
      endDate: { gt: start, lte: leaseWindowEnd },
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
      paymentAmount: contract.paymentAmount,
      paymentPeriod: contract.paymentPeriod,
      daysLeft: Math.round(
        (contract.endDate.getTime() - start.getTime()) / DAY_MS,
      ),
    });
  }

  // 4b. Contracts that have ended with nothing after them: the asset is no
  //     longer rented, so the owner is asked to renew or relist it. One
  //     alert per asset, about the contract that ended last — a daily-let
  //     asset whose stays are short contracts must not raise one per stay —
  //     and none for a short stay that was paid in full.
  const recentlyEnded = await prisma.rentalContract.findMany({
    where: {
      ...recentlyEndedWhere(start, CONTRACT_ENDED_DAYS),
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    select: { assetId: true },
  });
  const openEnded = await prisma.alert.findMany({
    where: { type: "contract_ended", status: "open", ...(operatorId ? { operatorId } : {}) },
    select: { id: true, payload: true },
  });
  const endedAssetIds = [
    ...new Set([
      ...recentlyEnded.map((row) => row.assetId),
      ...openEnded
        .map((alert) => (alert.payload as { assetId?: string } | null)?.assetId)
        .filter((id): id is string => !!id),
    ]),
  ];
  const endedAssets = endedAssetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: endedAssetIds } },
        include: { contracts: true },
      })
    : [];
  const endedWindowStart = new Date(start.getTime() - CONTRACT_ENDED_DAYS * DAY_MS);
  const followUpOf = new Map<string, string | null>();
  for (const asset of endedAssets) {
    const contract = endedContractToFollowUp(asset.contracts, start, (c) =>
      hasBalance(c, start, asset),
    );
    followUpOf.set(asset.id, contract?.id ?? null);
    if (!contract || contract.endDate <= endedWindowStart) continue;
    await push(asset.operatorId, null, "contract_ended", contract.id, {
      contractId: contract.id,
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      endDate: dayStamp(contract.endDate),
      tenantName: contract.tenantName,
    });
  }
  // Earlier "contract ended" alerts that no longer stand — a later stay
  // ended, or a new contract now follows — close themselves.
  await closeSupersededEndings(
    prisma,
    openEnded.filter((alert) => {
      const payload = alert.payload as { assetId?: string; contractId?: string } | null;
      if (!payload?.assetId || !followUpOf.has(payload.assetId)) return false;
      return followUpOf.get(payload.assetId) !== payload.contractId;
    }),
    now,
  );

  // 4c. Trackers gone quiet on a rented vehicle with a live red line. An
  //     unplugged or jammed tracker is the theft scenario, and its last
  //     position says nothing about where the car is now. One alert per
  //     silence episode; it closes itself when the tracker reports again.
  const silentBefore = new Date(now.getTime() - TRACKER_SILENT_MINUTES * 60_000);
  const quietDevices = await prisma.gpsDevice.findMany({
    where: {
      lastPingAt: { not: null, lt: silentBefore },
      asset: {
        ...(operatorId ? { operatorId } : {}),
        geofences: { some: { active: true } },
        contracts: { some: activeContractWhere(start) },
      },
    },
    include: {
      asset: { select: { id: true, operatorId: true, name: true, plateNumber: true } },
    },
  });
  for (const device of quietDevices) {
    if (!device.lastPingAt || !isTrackerSilent(device.lastPingAt, now)) continue;
    await push(
      device.asset.operatorId,
      null,
      "tracker_silent",
      silenceKey(device.deviceId, device.lastPingAt),
      {
        assetId: device.asset.id,
        assetName: device.asset.name,
        category: "vehicle",
        plate: device.asset.plateNumber,
        deviceId: device.deviceId,
        lastPingAt: device.lastPingAt.toISOString(),
        lat: device.lastLat,
        lng: device.lastLng,
      },
    );
  }

  // 5. Late rent on active contracts — and the day the repossession right
  //    kicks in. This also queues the WhatsApp reminders.
  const payments = await monitorRentPayments(now, operatorId);
  result.created += payments.alerts;

  return result;
}
