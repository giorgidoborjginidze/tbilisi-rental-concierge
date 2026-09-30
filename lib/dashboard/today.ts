// The dashboard's "Today" block, put in order. Pure.
//
// One place per line: a car that is late AND outside its red line is one
// rent card carrying both facts, not a card plus two alert rows further
// down. Urgent alerts of places without a rent card are rows. Rows and rent
// cards are then merged strictly by severity — whatever kind of line it is,
// a more severe one is never below a milder one.

import { alertRank } from "@/lib/alerts/rank";

/**
 * A rent card's rank on the alert scale (lib/alerts/rank.ts): the most
 * severe of what it carries. Past the grace period it is as loud as the
 * repossession right; a flag it carries (a double booking, a red line, a
 * silent tracker) raises it to that alert's rank.
 */
export function rentCardRank(card: { severe: boolean; flags: readonly string[] }): number {
  const base = alertRank(card.severe ? "repossession_right" : "rent_overdue");
  return Math.min(base, ...card.flags.map(alertRank));
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

export type TodaySegment<R, C> = { kind: "rows"; items: R[] } | { kind: "cards"; items: C[] };

/**
 * Rows and rent cards in one order, most severe first: both lists are
 * merged by rank (a row before a card of the same rank — the alert names
 * what the card only flags), and neighbours of the same kind stay together,
 * so the cards come as few blocks as the order allows. Each list keeps its
 * own order among equals.
 */
export function todaySegments<R extends { rank: number }, C>(
  rows: readonly R[],
  cards: readonly C[],
  cardRank: (card: C) => number,
): TodaySegment<R, C>[] {
  const sortedRows = [...rows].sort((a, b) => a.rank - b.rank);
  const sortedCards = [...cards].sort((a, b) => cardRank(a) - cardRank(b));
  const segments: TodaySegment<R, C>[] = [];
  const push = (kind: "rows" | "cards", item: R | C) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) (last.items as (R | C)[]).push(item);
    else segments.push({ kind, items: [item] } as TodaySegment<R, C>);
  };
  let r = 0;
  let c = 0;
  while (r < sortedRows.length || c < sortedCards.length) {
    const takeRow =
      c >= sortedCards.length ||
      (r < sortedRows.length && sortedRows[r].rank <= cardRank(sortedCards[c]));
    if (takeRow) push("rows", sortedRows[r++]);
    else push("cards", sortedCards[c++]);
  }
  return segments;
}
