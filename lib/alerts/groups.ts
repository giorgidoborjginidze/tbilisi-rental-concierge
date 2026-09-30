// Alerts as a short inbox: one group per flat, room or car ("ორბი ბიჩი —
// 3 თავისუფალი ფანჯარა"), the most severe group first, and inside a group
// one block per kind of alert. A unit and the asset linked to it are one
// place (lib/property/link.ts), so their alerts share a group. Pure.

import { alertDay, alertRank, byDay, rankAlerts } from "./rank";

export interface GroupableAlert {
  id: string;
  type: string;
  createdAt: Date;
  unitId: string | null;
  payload: unknown;
}

export interface AlertKind<T> {
  type: string;
  alerts: T[];
}

export interface AlertGroup<T> {
  /** Stable, URL-safe: "u-<unitId>", "a-<assetId>" or "x-<alertId>". */
  key: string;
  unitId: string | null;
  assetId: string | null;
  /** Most severe first (then soonest day, then newest). */
  alerts: T[];
  /** One block per alert type, in the same order. */
  kinds: AlertKind<T>[];
  /** The rank of its most severe alert (lib/alerts/rank.ts). */
  rank: number;
  /** The soonest day any of its alerts is about. */
  day: string | null;
}

const assetIdOf = (payload: unknown): string | null => {
  const id = (payload as { assetId?: unknown } | null)?.assetId;
  return typeof id === "string" && id ? id : null;
};

/** Which place an alert belongs to. `unitOfAsset` maps a linked asset to its unit. */
export function alertPlace(
  alert: Pick<GroupableAlert, "id" | "unitId" | "payload">,
  unitOfAsset: ReadonlyMap<string, string> = new Map(),
): { key: string; unitId: string | null; assetId: string | null } {
  const assetId = assetIdOf(alert.payload);
  const unitId = alert.unitId ?? (assetId ? unitOfAsset.get(assetId) ?? null : null);
  if (unitId) return { key: `u-${unitId}`, unitId, assetId };
  if (assetId) return { key: `a-${assetId}`, unitId: null, assetId };
  return { key: `x-${alert.id}`, unitId: null, assetId: null };
}

export function groupAlerts<T extends GroupableAlert>(
  alerts: T[],
  unitOfAsset: ReadonlyMap<string, string> = new Map(),
): AlertGroup<T>[] {
  const byKey = new Map<string, AlertGroup<T>>();
  for (const alert of rankAlerts(alerts)) {
    const place = alertPlace(alert, unitOfAsset);
    let group = byKey.get(place.key);
    if (!group) {
      group = { ...place, alerts: [], kinds: [], rank: alertRank(alert.type), day: null };
      byKey.set(place.key, group);
    }
    // A unit's group also knows the asset linked to it (for its desk).
    if (!group.assetId && place.assetId) group.assetId = place.assetId;
    group.alerts.push(alert);
    const kind = group.kinds.find((k) => k.type === alert.type);
    if (kind) kind.alerts.push(alert);
    else group.kinds.push({ type: alert.type, alerts: [alert] });
    const day = alertDay(alert.payload);
    if (day && (!group.day || day < group.day)) group.day = day;
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.rank - b.rank ||
      byDay({ start: a.day }, { start: b.day }) ||
      b.alerts[0].createdAt.getTime() - a.alerts[0].createdAt.getTime(),
  );
}

/**
 * Market Advice: the non-urgent alerts, one tip per kind per place (three
 * free windows of one flat are one tip that names the nearest), the most
 * useful first — a price to raise before a free window, the soonest first.
 */
export function adviceTips<T extends GroupableAlert>(
  alerts: T[],
  types: readonly string[],
  unitOfAsset: ReadonlyMap<string, string> = new Map(),
): (AlertKind<T> & { key: string; unitId: string | null; assetId: string | null })[] {
  const tips = new Map<string, AlertKind<T> & { key: string; unitId: string | null; assetId: string | null }>();
  for (const alert of rankAlerts(alerts.filter((a) => types.includes(a.type)))) {
    const place = alertPlace(alert, unitOfAsset);
    const key = `${alert.type}:${place.key}`;
    const tip = tips.get(key);
    if (tip) tip.alerts.push(alert);
    else tips.set(key, { ...place, key, type: alert.type, alerts: [alert] });
  }
  // rankAlerts already put them in reading order; the first alert of each
  // tip is its soonest.
  return [...tips.values()];
}
