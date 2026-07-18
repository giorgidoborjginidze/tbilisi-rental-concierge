import type { MatchableListing } from "./types";

/**
 * Build a coarse fingerprint for near-duplicate detection: same district and
 * street stem, with price and area bucketed so small re-post jitter collapses
 * together. Two listings sharing a key are treated as the same underlying unit.
 */
export function dedupeKey(l: MatchableListing): string {
  const street = l.addressApprox.toLowerCase().replace(/\s+/g, "").replace(/,.*/, "");
  const priceBucket = Math.round(l.price / 50); // ±$25
  const areaBucket = l.areaSqm != null ? Math.round(l.areaSqm / 5) : "na"; // ±2.5 m²
  return `${l.district}|${street}|${priceBucket}|${areaBucket}`;
}

/**
 * Collapse near-duplicate listings, keeping the freshest (latest lastSeenAt) of
 * each group. Order of survivors follows first appearance in the input.
 */
export function dedupeListings(listings: MatchableListing[]): MatchableListing[] {
  const byKey = new Map<string, MatchableListing>();
  const order: string[] = [];

  for (const l of listings) {
    const key = dedupeKey(l);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, l);
      order.push(key);
      continue;
    }
    if (l.lastSeenAt.getTime() > existing.lastSeenAt.getTime()) {
      byKey.set(key, l);
    }
  }

  return order.map((k) => byKey.get(k)!);
}
