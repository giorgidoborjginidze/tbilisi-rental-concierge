// Alert scan job: vacancy gaps, double bookings, expiring leases,
// underpriced units, finished contracts, silent GPS trackers and late rent.
// Each alert carries a structured payload plus a stable `key` used to
// dedupe against existing alerts, so re-running the scan never spams: an
// open alert whose situation still holds gets its figures refreshed, one
// the system closed comes back if its situation returns, and one the owner
// closed stays closed. Alerts whose situation is over close themselves.
// Suggested-action text is rendered localized in the UI from `type`.

import { prisma } from "@/lib/db";
import type { Stay } from "@/lib/calendar/occupancy";
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
import {
  closeSupersededEndings,
  RENT_ALERTS,
  resolveAlerts,
  resolveUnmonitoredSilence,
  type WithdrawReason,
} from "@/lib/rentals/settle";
import { isTrackerSilent, silenceKey, TRACKER_SILENT_MINUTES } from "@/lib/geo/silence";
import { dayKey, startOfTodayTbilisi } from "@/lib/time";
import {
  OVERLAP_HORIZON_DAYS,
  overlapSignals,
  staleOverlapAlerts,
  staleVacancyAlerts,
  vacancySignals,
  VACANCY_HORIZON_DAYS,
  type OverlapSignal,
} from "./signals";
import { LIVE_STAY } from "@/lib/bookings/live";

const DAY_MS = 86_400_000;
/** The window the "underpriced" check looks at for upcoming occupancy. */
const PRICING_WINDOW_DAYS = 30;
const LEASE_EXPIRY_DAYS = 30;
/** How far back a finished contract still earns a "contract ended" alert. */
const CONTRACT_ENDED_DAYS = 60;

export interface ScanResult {
  created: number;
  skipped: number; // already-open duplicates, or closed by the owner
  /** Alerts the scan closed because their situation is over. */
  resolved: number;
}

const dayStamp = dayKey;

type AlertRow = { id: string; type: string; status: string; payload: unknown };

const payloadKey = (payload: unknown) => (payload as { key?: string } | null)?.key ?? "";

/** The two stays of a double booking, as the alert shows them. */
const overlapStays = (overlap: OverlapSignal, tenants?: Map<string, string | null>) =>
  overlap.stays.map((stay) => ({
    id: stay.id,
    source: stay.kind,
    start: dayStamp(stay.start),
    end: dayStamp(stay.end),
    ...(tenants ? { tenantName: tenants.get(stay.id) ?? null } : {}),
  }));

export async function scanAlerts(
  now = new Date(),
  operatorId?: string,
): Promise<ScanResult> {
  // Tbilisi's today, in the stored form of a calendar day.
  const start = startOfTodayTbilisi(now);
  const pricingWindowEnd = new Date(start.getTime() + PRICING_WINDOW_DAYS * DAY_MS);
  const lookAhead = new Date(
    start.getTime() + Math.max(OVERLAP_HORIZON_DAYS, VACANCY_HORIZON_DAYS) * DAY_MS,
  );
  const leaseWindowEnd = new Date(start.getTime() + LEASE_EXPIRY_DAYS * DAY_MS);
  const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  const scope = operatorId ? { operatorId } : {};

  const units = await prisma.unit.findMany({
    where: scope,
    include: {
      bookings: {
        where: {
          ...LIVE_STAY,
          checkIn: { lt: lookAhead },
          checkOut: { gt: start },
        },
      },
      leases: true,
    },
  });
  // The last checkout on or before today bounds each unit's first free
  // window, so that window keeps one identity from day to day.
  const lastCheckout = new Map(
    (
      await prisma.booking.groupBy({
        by: ["unitId"],
        where: {
          ...LIVE_STAY,
          checkOut: { lte: start },
          ...(operatorId ? { unit: { operatorId } } : {}),
        },
        _max: { checkOut: true },
      })
    ).map((row) => [row.unitId, row._max.checkOut]),
  );

  // Dedupe against every existing alert regardless of status — a dismissed
  // or resolved alert must not reappear on the next scan (unless the system
  // closed it and its situation is back).
  const existingAlerts = await prisma.alert.findMany({
    where: scope,
    select: { id: true, type: true, status: true, payload: true, unitId: true },
  });
  const known = new Map<string, AlertRow>();
  for (const alert of existingAlerts) {
    const dedupeKey = `${alert.type}|${alert.unitId ?? ""}|${payloadKey(alert.payload)}`;
    // Prefer the open one when an older duplicate exists.
    if (!known.has(dedupeKey) || alert.status === "open") known.set(dedupeKey, alert);
  }
  const openOf = (type: string, where: (alert: (typeof existingAlerts)[number]) => boolean) =>
    existingAlerts.filter((alert) => alert.type === type && alert.status === "open" && where(alert));

  const market = getMarketDataSource();
  const result: ScanResult = { created: 0, skipped: 0, resolved: 0 };

  const push = async (
    operatorId: string,
    unitId: string | null,
    type: string,
    key: string,
    payload: Record<string, unknown>,
  ) => {
    const dedupeKey = `${type}|${unitId ?? ""}|${key}`;
    const data = { key, ...payload };
    const found = known.get(dedupeKey);
    if (!found) {
      const created = await prisma.alert.create({
        data: { operatorId, unitId, type, payload: data },
      });
      known.set(dedupeKey, { id: created.id, type, status: "open", payload: data });
      result.created += 1;
      return;
    }
    if (found.status === "open") {
      // Still true: keep its figures current (nights left, days left).
      if (JSON.stringify(found.payload) !== JSON.stringify(data)) {
        await prisma.alert.update({ where: { id: found.id }, data: { payload: data } });
        found.payload = data;
      }
      result.skipped += 1;
      return;
    }
    if (found.status === "resolved" && (found.payload as { autoResolved?: string }).autoResolved) {
      // Closed by the system and true again (a booking was cancelled): back.
      await prisma.alert.update({
        where: { id: found.id },
        data: { status: "open", resolvedAt: null, payload: data },
      });
      found.status = "open";
      found.payload = data;
      result.created += 1;
      return;
    }
    // Closed by the owner: stays closed.
    result.skipped += 1;
  };

  const close = async (rows: { id: string; reason: WithdrawReason }[]) => {
    const byReason = new Map<WithdrawReason, { id: string; payload: unknown }[]>();
    for (const row of rows) {
      const alert = existingAlerts.find((a) => a.id === row.id);
      if (!alert || alert.status !== "open") continue;
      alert.status = "resolved";
      byReason.set(row.reason, [...(byReason.get(row.reason) ?? []), alert]);
    }
    for (const [reason, alerts] of byReason) {
      result.resolved += await resolveAlerts(prisma, alerts, reason, now);
    }
  };

  for (const unit of units) {
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
    const previous = lastCheckout.get(unit.id);
    const bounded: Stay[] = previous
      ? [...stays, { id: "previous", kind: "past", start: previous, end: previous }]
      : stays;

    // 1. Free windows starting within two weeks (leases count as
    //    occupancy). One alert per window, figures refreshed daily; closed
    //    once it is booked or over.
    const gaps = vacancySignals(bounded, start);
    for (const gap of gaps) {
      await push(unit.operatorId, unit.id, "vacancy_gap", gap.key, {
        start: dayStamp(gap.start),
        end: dayStamp(gap.end),
        nights: gap.nights,
        openEnd: gap.openEnd,
        unitName: unit.name,
      });
    }
    await close(
      staleVacancyAlerts(
        openOf("vacancy_gap", (alert) => alert.unitId === unit.id),
        new Set(gaps.map((gap) => gap.key)),
        stays,
        start,
      ),
    );

    // 2. Double bookings in the next 90 days: two stays on the same nights.
    const overlaps = overlapSignals(stays, start);
    for (const overlap of overlaps) {
      await push(unit.operatorId, unit.id, "overlap", overlap.key, {
        start: dayStamp(overlap.start),
        end: dayStamp(overlap.end),
        nights: overlap.nights,
        stays: overlapStays(overlap),
        unitName: unit.name,
      });
    }
    await close(
      staleOverlapAlerts(
        openOf("overlap", (alert) => alert.unitId === unit.id),
        new Set(overlaps.map((overlap) => overlap.key)),
        start,
      ),
    );

    // 3. Running leases (by their dates) expiring within N days. One that
    //    has since ended, been extended or deleted no longer needs the alert.
    const expiringLeases = new Set<string>();
    for (const lease of unit.leases) {
      if (
        contractPhase(lease, start) === "active" &&
        lease.endDate <= leaseWindowEnd
      ) {
        expiringLeases.add(lease.id);
        await push(unit.operatorId, unit.id, "lease_expiry", lease.id, {
          leaseId: lease.id,
          endDate: dayStamp(lease.endDate),
          tenantName: lease.tenantName,
          daysLeft: Math.round((lease.endDate.getTime() - start.getTime()) / DAY_MS),
          unitName: unit.name,
        });
      }
    }
    await close(
      openOf("lease_expiry", (alert) => alert.unitId === unit.id)
        .filter((alert) => !expiringLeases.has(payloadKey(alert.payload)))
        .map((alert) => {
          const lease = unit.leases.find((l) => l.id === payloadKey(alert.payload));
          return {
            id: alert.id,
            reason: lease && lease.endDate <= start ? ("passed" as const) : ("changed" as const),
          };
        }),
    );

    // 4. Underpriced vs the district benchmark (this month).
    const occupiedNights = new Set<number>();
    for (const booking of unit.bookings) {
      for (
        let t = Math.max(booking.checkIn.getTime(), start.getTime());
        t < Math.min(booking.checkOut.getTime(), pricingWindowEnd.getTime());
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
      upcomingOccupancy: occupiedNights.size / PRICING_WINDOW_DAYS,
      benchmarkAdr: benchmark?.adr ?? null,
    });
    const underpriced = pricing.underpriced && !!benchmark;
    // Last month's advice is over; this month's once the rate was raised.
    await close(
      openOf("underpriced", (alert) => alert.unitId === unit.id)
        .filter((alert) => payloadKey(alert.payload) !== month || !underpriced)
        .map((alert) => ({
          id: alert.id,
          reason: payloadKey(alert.payload) !== month ? ("passed" as const) : ("changed" as const),
        })),
    );
    if (underpriced && benchmark) {
      await push(unit.operatorId, unit.id, "underpriced", month, {
        month,
        district: unit.district,
        benchmarkAdr: benchmark.adr,
        suggestedRate: pricing.suggestedRate,
        baseNightlyRate: unit.baseNightlyRate,
        unitName: unit.name,
      });
    }
  }

  // 5. Two rental contracts on the same asset at the same time — a car let
  //    to two drivers, or an old contract whose end date was never moved
  //    when the next one started (its renter would keep being chased).
  const liveContracts = await prisma.rentalContract.findMany({
    where: {
      endDate: { gt: start },
      startDate: { lt: new Date(start.getTime() + OVERLAP_HORIZON_DAYS * DAY_MS) },
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    select: {
      id: true,
      assetId: true,
      startDate: true,
      endDate: true,
      tenantName: true,
      asset: { select: { operatorId: true, name: true, category: true } },
    },
  });
  const contractsByAsset = new Map<string, typeof liveContracts>();
  for (const contract of liveContracts) {
    contractsByAsset.set(contract.assetId, [...(contractsByAsset.get(contract.assetId) ?? []), contract]);
  }
  const contractOverlapKeys = new Map<string, Set<string>>();
  for (const [assetId, contracts] of contractsByAsset) {
    const tenants = new Map(contracts.map((c) => [c.id, c.tenantName]));
    const overlaps = overlapSignals(
      contracts.map((c) => ({ id: c.id, kind: "contract", start: c.startDate, end: c.endDate })),
      start,
    );
    contractOverlapKeys.set(assetId, new Set(overlaps.map((overlap) => overlap.key)));
    for (const overlap of overlaps) {
      const asset = contracts[0].asset;
      await push(asset.operatorId, null, "overlap", overlap.key, {
        start: dayStamp(overlap.start),
        end: dayStamp(overlap.end),
        nights: overlap.nights,
        stays: overlapStays(overlap, tenants),
        assetId,
        assetName: asset.name,
        category: asset.category,
      });
    }
  }
  const openContractOverlaps = openOf(
    "overlap",
    (alert) => alert.unitId == null && !!(alert.payload as { assetId?: string } | null)?.assetId,
  );
  await close(
    staleOverlapAlerts(
      openContractOverlaps,
      new Set(
        openContractOverlaps
          .filter((alert) =>
            contractOverlapKeys
              .get((alert.payload as { assetId: string }).assetId)
              ?.has(payloadKey(alert.payload)),
          )
          .map((alert) => payloadKey(alert.payload)),
      ),
      start,
    ),
  );

  // 6. Asset rental contracts running today and expiring within N days —
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
  // Expiry alerts whose contract has since ended (the "contract ended"
  // alert takes over), was renewed or deleted close themselves.
  const openExpiry = openOf("contract_expiry", () => true);
  const expiryContracts = new Map(
    (
      await prisma.rentalContract.findMany({
        where: { id: { in: openExpiry.map((alert) => payloadKey(alert.payload)) } },
        select: { id: true, startDate: true, endDate: true },
      })
    ).map((contract) => [contract.id, contract]),
  );
  await close(
    openExpiry.flatMap((alert): { id: string; reason: WithdrawReason }[] => {
      const contract = expiryContracts.get(payloadKey(alert.payload));
      if (!contract) return [{ id: alert.id, reason: "contract_deleted" }];
      if (contractPhase(contract, start) === "ended") return [{ id: alert.id, reason: "contract_ended" }];
      if (contract.endDate > leaseWindowEnd) return [{ id: alert.id, reason: "changed" }];
      return [];
    }),
  );
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

  // 7. Contracts that have ended with nothing after them: the asset is no
  //    longer rented, so the owner is asked to renew or relist it. One
  //    alert per asset, about the contract that ended last — a daily-let
  //    asset whose stays are short contracts must not raise one per stay —
  //    and none for a short stay that was paid in full.
  //
  //    Rent left unpaid is different: it stays in sight whatever came
  //    next. Its late-rent alert stays open (settle.ts staleRentAlert);
  //    a finished contract that owes money and has no such alert — the car
  //    went straight to the next driver — gets a "contract ended" alert of
  //    its own, which /alerts shows with the unpaid amount.
  const recentlyEnded = await prisma.rentalContract.findMany({
    where: {
      ...recentlyEndedWhere(start, CONTRACT_ENDED_DAYS),
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    select: { assetId: true },
  });
  const openEnded = await prisma.alert.findMany({
    where: { type: "contract_ended", status: "open", ...scope },
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
  const rentAlertContracts = new Set(
    (
      await prisma.alert.findMany({
        where: { type: { in: RENT_ALERTS }, status: "open", ...scope },
        select: { payload: true },
      })
    )
      .map((alert) => (alert.payload as { contractId?: string } | null)?.contractId)
      .filter(Boolean),
  );
  const endedWindowStart = new Date(start.getTime() - CONTRACT_ENDED_DAYS * DAY_MS);
  const followUpOf = new Map<string, string | null>();
  const owing = new Set<string>();
  for (const asset of endedAssets) {
    const contract = endedContractToFollowUp(asset.contracts, start, (c) =>
      hasBalance(c, start, asset),
    );
    followUpOf.set(asset.id, contract?.id ?? null);
    const endedPayload = (c: (typeof asset.contracts)[number]) => ({
      contractId: c.id,
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      endDate: dayStamp(c.endDate),
      tenantName: c.tenantName,
    });
    if (contract && contract.endDate > endedWindowStart) {
      await push(asset.operatorId, null, "contract_ended", contract.id, endedPayload(contract));
    }
    for (const other of asset.contracts) {
      if (contractPhase(other, start) !== "ended" || !hasBalance(other, start, asset)) continue;
      owing.add(other.id);
      if (other.id === contract?.id || other.endDate <= endedWindowStart) continue;
      if (rentAlertContracts.has(other.id)) continue;
      await push(asset.operatorId, null, "contract_ended", other.id, endedPayload(other));
    }
  }
  // Earlier "contract ended" alerts that no longer stand — a later stay
  // ended, or a new contract now follows — close themselves, unless rent
  // is still owed under that contract.
  result.resolved += await closeSupersededEndings(
    prisma,
    openEnded.filter((alert) => {
      const payload = alert.payload as { assetId?: string; contractId?: string } | null;
      if (!payload?.assetId || !followUpOf.has(payload.assetId)) return false;
      if (payload.contractId && owing.has(payload.contractId)) return false;
      return followUpOf.get(payload.assetId) !== payload.contractId;
    }),
    now,
  );

  // 8. Trackers gone quiet on a rented vehicle with a live red line. An
  //    unplugged or jammed tracker is the theft scenario, and its last
  //    position says nothing about where the car is now. One alert per
  //    silence episode; it closes itself when the tracker reports again.
  const silentBefore = new Date(now.getTime() - TRACKER_SILENT_MINUTES * 60_000);
  const quietDevices = await prisma.gpsDevice.findMany({
    where: {
      lastPingAt: { not: null, lt: silentBefore },
      asset: {
        ...scope,
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

  // A silence alert for a vehicle nobody watches any more (tracker
  // disconnected, red lines paused or deleted, rental over) will never be
  // closed by a ping — close it here.
  const monitored = await prisma.gpsDevice.findMany({
    where: {
      asset: {
        ...scope,
        geofences: { some: { active: true } },
        contracts: { some: activeContractWhere(start) },
      },
    },
    select: { assetId: true },
  });
  result.resolved += await resolveUnmonitoredSilence(
    prisma,
    operatorId,
    new Set(monitored.map((device) => device.assetId)),
    now,
  );

  // 9. Late rent on active contracts — and the day the repossession right
  //    kicks in. This also queues the WhatsApp reminders.
  const payments = await monitorRentPayments(now, operatorId);
  result.created += payments.alerts;

  return result;
}
