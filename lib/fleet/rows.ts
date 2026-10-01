// The fleet's rows: every vehicle and where it stands today — who drives
// it, what is owed and how late, whether the tracker still speaks, whether
// it is outside its red line — shared by /fleet (list and table) and its
// spreadsheet export.

import { prisma } from "@/lib/db";
import { activeContract, contractPhase } from "@/lib/rentals/phase";
import { settlementContract, statusFor } from "@/lib/rentals/terms";
import { fleetRank } from "@/lib/rentals/desk";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { isTrackerSilent } from "@/lib/geo/silence";
import { LIVE_CONTRACT } from "@/lib/rentals/live";

export async function loadFleetRows(operatorId: string, today: Date, now: Date) {
  const vehicles = await prisma.asset.findMany({
    where: { operatorId, category: "vehicle" },
    include: {
      contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
      gpsDevice: true,
      geofences: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  // A red line crossed and not yet resolved: the car counts as outside
  // even when its tracker has since gone quiet (the last word it gave).
  const breached = new Set(
    (
      await prisma.alert.findMany({
        where: { operatorId, status: "open", type: "geofence_breach" },
        select: { payload: true },
        take: 200,
      })
    )
      .map((alert) => (alert.payload as { assetId?: string } | null)?.assetId)
      .filter((id): id is string => !!id),
  );

  const rows = vehicles.map((vehicle) => {
    const running = activeContract(vehicle.contracts, today) ?? null;
    const money = settlementContract(vehicle.contracts, today, vehicle) ?? null;
    const endedOwing = money != null && contractPhase(money, today) === "ended";
    const status = money?.paidThrough ? statusFor(money, today, vehicle) : null;
    const owes = status != null && status.periodsOwed > 0 && status.amountDue > 0;
    const device = vehicle.gpsDevice;
    const watched = vehicle.geofences.length > 0 && running != null;
    const silent = watched && device?.lastPingAt != null && isTrackerSilent(device.lastPingAt, now);
    const position =
      device?.lastLat != null && device.lastLng != null && !silent
        ? { lat: device.lastLat, lng: device.lastLng }
        : null;
    const outside =
      (watched && breached.has(vehicle.id)) ||
      (position != null &&
        vehicle.geofences.some((fence) => {
          const shape = shapeFromRow(fence);
          return shape ? evaluateFence(shape, fence.approachKm, position).zone === "outside" : false;
        }));
    return {
      vehicle,
      running,
      money,
      status,
      owes: owes && (endedOwing || running != null),
      endedOwing: endedOwing && owes,
      silent,
      outside,
      lastPingAt: device?.lastPingAt ?? null,
      rank: fleetRank({
        payState: status?.state ?? null,
        endedOwing: endedOwing && owes,
        outside,
        silent,
        rented: running != null,
      }),
    };
  });
  rows.sort((a, b) => a.rank - b.rank || a.vehicle.name.localeCompare(b.vehicle.name));
  return rows;
}

export type FleetRow = Awaited<ReturnType<typeof loadFleetRows>>[number];

export const FLEET_SORTS = ["urgent", "name", "owed", "end", "ping"] as const;
export type FleetSort = (typeof FLEET_SORTS)[number];

export const asFleetSort = (value: string | null | undefined): FleetSort =>
  (FLEET_SORTS as readonly string[]).includes(value ?? "") ? (value as FleetSort) : "urgent";

/** The table's order: the most urgent (default), by name, most owed, soonest end, oldest tracker word. */
export function sortFleet<T extends Pick<FleetRow, "rank" | "vehicle" | "status" | "owes" | "running" | "lastPingAt">>(
  rows: T[],
  sort: FleetSort,
): T[] {
  const name = (a: T, b: T) => a.vehicle.name.localeCompare(b.vehicle.name);
  const owed = (row: T) => (row.owes && row.status ? row.status.amountDue : 0);
  const end = (row: T) => row.running?.endDate.getTime() ?? Number.POSITIVE_INFINITY;
  const ping = (row: T) => row.lastPingAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const by: Record<FleetSort, (a: T, b: T) => number> = {
    urgent: (a, b) => a.rank - b.rank || name(a, b),
    name,
    owed: (a, b) => owed(b) - owed(a) || name(a, b),
    end: (a, b) => end(a) - end(b) || name(a, b),
    ping: (a, b) => ping(a) - ping(b) || name(a, b),
  };
  return [...rows].sort(by[sort]);
}
