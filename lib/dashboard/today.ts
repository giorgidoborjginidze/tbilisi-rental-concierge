// The dashboard's "Today" block, put in order. Pure.
//
// One place per line: a car that is late AND outside its red line is one
// rent card carrying both facts, not a card plus two alert rows further
// down. Urgent alerts of places without a rent card are rows; the rows as
// severe as the worst rent card or worse come before the cards, the rest
// after them — severity first, whatever kind of line it is.

import { alertRank } from "@/lib/alerts/rank";

/** A rent card's rank on the alert scale (lib/alerts/rank.ts). */
export function rentCardRank(card: { severe: boolean; flags: readonly string[] }): number {
  // Past the grace period, or outside a red line: as loud as the
  // repossession right itself.
  if (card.severe || card.flags.includes("geofence_breach") || card.flags.includes("repossession_right")) {
    return alertRank("repossession_right");
  }
  if (card.flags.includes("tracker_silent")) return alertRank("tracker_silent");
  return alertRank("rent_overdue");
}

export interface UrgentGroup {
  assetId: string | null;
  rank: number;
  kinds: { type: string }[];
}

/**
 * Split the urgent alert groups: those of an asset that has a rent card
 * become that card's flags; the others stay rows.
 */
export function foldIntoCards<G extends UrgentGroup>(
  groups: G[],
  cardAssets: ReadonlySet<string>,
): { rows: G[]; flags: Map<string, string[]> } {
  const flags = new Map<string, string[]>();
  const rows: G[] = [];
  for (const group of groups) {
    if (group.assetId && cardAssets.has(group.assetId)) {
      flags.set(group.assetId, group.kinds.map((kind) => kind.type));
    } else {
      rows.push(group);
    }
  }
  return { rows, flags };
}

/** Rows at least as severe as the worst rent card go before the cards. */
export function aroundCards<G extends { rank: number }>(
  rows: G[],
  topCardRank: number | null,
): { before: G[]; after: G[] } {
  if (topCardRank == null) return { before: rows, after: [] };
  return {
    before: rows.filter((row) => row.rank <= topCardRank),
    after: rows.filter((row) => row.rank > topCardRank),
  };
}
