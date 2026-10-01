// The silent-tracker check on its own, so it runs far more often than the
// daily scan: every calendar sync, every ping from another tracker of the
// workspace, and whenever the owner opens Home, the fleet or the alerts
// (throttled). A tracker unplugged at 10:00 is announced within minutes of
// the next of those — not the next morning. Each silence episode raises one
// alert and queues one WhatsApp message to the owner; the next accepted
// ping closes the alert (lib/geo/monitor.ts).

import { prisma } from "@/lib/db";
import { asLocale } from "@/lib/i18n/strings";
import { activeContractWhere } from "@/lib/rentals/phase";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { baseVars } from "@/lib/notify/vars";
import { flushOutbox, queueMessage } from "@/lib/notify/whatsapp";
import { isTrackerSilent, silenceKey, TRACKER_SILENT_MINUTES } from "./silence";

/**
 * Raise the alert (and the owner's message) for every tracker gone quiet
 * on a rented vehicle with a live red line. Returns how many alerts were
 * created. `operatorId` limits it to one workspace.
 */
export async function checkTrackerSilence(now: Date = new Date(), operatorId?: string): Promise<number> {
  const start = startOfTodayTbilisi(now);
  const silentBefore = new Date(now.getTime() - TRACKER_SILENT_MINUTES * 60_000);
  const quiet = await prisma.gpsDevice.findMany({
    where: {
      lastPingAt: { not: null, lt: silentBefore },
      asset: {
        ...(operatorId ? { operatorId } : {}),
        geofences: { some: { active: true } },
        contracts: { some: { ...activeContractWhere(start), ...LIVE_CONTRACT } },
      },
    },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          nameKa: true,
          plateNumber: true,
          operator: { select: { id: true, locale: true, notifyPhone: true, name: true, isDemo: true } },
        },
      },
    },
  });
  const devices = quiet.filter((device) => device.lastPingAt && isTrackerSilent(device.lastPingAt, now));
  if (devices.length === 0) return 0;

  const operatorIds = [...new Set(devices.map((device) => device.asset.operator.id))];
  const known = new Set(
    (
      await prisma.alert.findMany({
        where: { operatorId: { in: operatorIds }, type: "tracker_silent" },
        select: { payload: true },
      })
    ).map((alert) => (alert.payload as { key?: string } | null)?.key ?? ""),
  );

  let created = 0;
  const toFlush = new Set<string>();
  for (const device of devices) {
    const key = silenceKey(device.deviceId, device.lastPingAt!);
    if (known.has(key)) continue; // this episode is known (open, or closed by the owner)
    known.add(key);
    const operator = device.asset.operator;
    await prisma.alert.create({
      data: {
        operatorId: operator.id,
        unitId: null,
        type: "tracker_silent",
        payload: {
          key,
          assetId: device.asset.id,
          assetName: device.asset.name,
          category: "vehicle",
          plate: device.asset.plateNumber,
          deviceId: device.deviceId,
          lastPingAt: device.lastPingAt!.toISOString(),
          lat: device.lastLat,
          lng: device.lastLng,
        },
      },
    });
    created += 1;

    const locale = asLocale(operator.locale);
    const queued = await queueMessage({
      operatorId: operator.id,
      locale,
      key: "gps_silent_owner",
      dedupeKey: `silent|${key}`,
      phone: operator.notifyPhone,
      vars: {
        ...baseVars(locale, device.asset, operator),
        since: tbilisiFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
          device.lastPingAt!,
        ),
      },
      assetId: device.asset.id,
      now,
    });
    if (queued && !operator.isDemo) toFlush.add(operator.id);
  }
  for (const id of toFlush) await flushOutbox(id).catch(() => undefined);
  return created;
}

const lastCheck = new Map<string, number>();
/** How often a page view or a ping may run the check for one workspace. */
export const SILENCE_CHECK_EVERY_MS = 5 * 60_000;

/**
 * The same check, at most once every few minutes per workspace — for page
 * views and pings. Never throws: a failed check must not break a page.
 */
export async function checkTrackerSilenceSoon(operatorId: string, now: Date = new Date()): Promise<void> {
  const last = lastCheck.get(operatorId) ?? 0;
  if (now.getTime() - last < SILENCE_CHECK_EVERY_MS) return;
  lastCheck.set(operatorId, now.getTime());
  await checkTrackerSilence(now, operatorId).catch((error) =>
    console.error("[silence-check] failed:", error),
  );
}
