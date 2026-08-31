import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/strings";
import { queueMessage } from "@/lib/notify/whatsapp";
import type { TemplateKey } from "@/lib/notify/templates";
import {
  evaluateFence,
  shapeFromRow,
  transition,
  type LatLng,
  type Transition,
  type Zone,
} from "./fence";

// Turns a GPS position into events and WhatsApp messages.
//
// The rule that keeps this quiet: a message is written only when the
// vehicle *changes* zone. A car parked one street past the line pings every
// minute; the owner hears about it exactly once.

export interface PingInput {
  lat: number;
  lng: number;
  speed?: number | null;
  at?: Date;
}

export interface PingOutcome {
  fenceId: string;
  fenceName: string;
  zone: Zone;
  distanceKm: number;
  event: Transition | null;
  queued: number;
}

/** The zone the last recorded event left the vehicle in. */
function zoneFromLastEvent(kind: string | undefined): Zone | null {
  if (kind === "breach") return "outside";
  if (kind === "approach") return "approach";
  if (kind === "return") return "safe";
  return null;
}

const DRIVER_KEY: Record<Exclude<Transition, "return">, TemplateKey> = {
  approach: "geo_approach_driver",
  breach: "geo_breach_driver",
};
const OWNER_KEY: Record<Exclude<Transition, "return">, TemplateKey> = {
  approach: "geo_approach_owner",
  breach: "geo_breach_owner",
};

/**
 * Evaluate one position against every active fence on the asset, record
 * what changed and queue the two messages the change calls for.
 */
export async function processPing(
  assetId: string,
  ping: PingInput,
): Promise<PingOutcome[]> {
  const point: LatLng = { lat: ping.lat, lng: ping.lng };
  const at = ping.at ?? new Date();

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      operator: { select: { id: true, locale: true, notifyPhone: true } },
      geofences: { where: { active: true } },
      contracts: {
        where: { status: "active" },
        orderBy: { endDate: "desc" },
        take: 1,
      },
    },
  });
  if (!asset) return [];

  await prisma.gpsDevice.updateMany({
    where: { assetId },
    data: {
      lastLat: ping.lat,
      lastLng: ping.lng,
      lastSpeed: ping.speed ?? null,
      lastPingAt: at,
    },
  });

  const locale = (asset.operator.locale === "ka" ? "ka" : "en") as Locale;
  const contract = asset.contracts[0] ?? null;
  const vars = {
    plate: asset.plateNumber ?? "—",
    asset: asset.name,
    driver: contract?.tenantName ?? "—",
  };

  const outcomes: PingOutcome[] = [];

  for (const fence of asset.geofences) {
    const shape = shapeFromRow(fence);
    if (!shape) continue;

    const reading = evaluateFence(shape, fence.approachKm, point);
    const last = await prisma.geoEvent.findFirst({
      where: { geofenceId: fence.id },
      orderBy: { createdAt: "desc" },
      select: { kind: true },
    });
    const event = transition(zoneFromLastEvent(last?.kind), reading.zone);

    let queued = 0;
    if (event) {
      const row = await prisma.geoEvent.create({
        data: {
          assetId,
          geofenceId: fence.id,
          kind: event,
          lat: ping.lat,
          lng: ping.lng,
          distanceKm: reading.distanceKm,
        },
      });

      // Coming back inside is recorded but not announced — nobody needs a
      // WhatsApp message telling them the problem went away.
      if (event !== "return") {
        const eventVars = { ...vars, fence: fence.name };
        const queuedDriver = await queueMessage({
          operatorId: asset.operator.id,
          locale,
          key: DRIVER_KEY[event],
          dedupeKey: `geo|${row.id}|driver`,
          phone: contract?.tenantPhone,
          vars: eventVars,
          assetId,
          contractId: contract?.id ?? null,
        });
        const queuedOwner = await queueMessage({
          operatorId: asset.operator.id,
          locale,
          key: OWNER_KEY[event],
          dedupeKey: `geo|${row.id}|owner`,
          phone: asset.operator.notifyPhone,
          vars: eventVars,
          assetId,
          contractId: contract?.id ?? null,
        });
        queued = (queuedDriver ? 1 : 0) + (queuedOwner ? 1 : 0);
      }

      // A crossing also lands in the alert feed, so it is visible in the
      // app even if WhatsApp is not configured yet.
      if (event === "breach") {
        await prisma.alert.create({
          data: {
            operatorId: asset.operator.id,
            unitId: null,
            type: "geofence_breach",
            payload: {
              key: row.id,
              assetId,
              assetName: asset.name,
              plate: asset.plateNumber,
              fenceName: fence.name,
              lat: ping.lat,
              lng: ping.lng,
              distanceKm: Math.round(reading.distanceKm * 10) / 10,
              driverName: contract?.tenantName ?? null,
              driverPhone: contract?.tenantPhone ?? null,
            },
          },
        });
      }
    }

    outcomes.push({
      fenceId: fence.id,
      fenceName: fence.name,
      zone: reading.zone,
      distanceKm: reading.distanceKm,
      event,
      queued,
    });
  }

  return outcomes;
}
