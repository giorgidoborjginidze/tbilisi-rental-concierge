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
  kinds: { type: string; alerts?: readonly { payload?: unknown }[] }[];
}

export interface RentCardRef {
  contractId: string;
  assetId: string;
}

const contractOf = (alert: { payload?: unknown }): string | null => {
  const id = (alert.payload as { contractId?: unknown } | null | undefined)?.contractId;
  return typeof id === "string" && id ? id : null;
};

/**
 * Split the urgent alert groups: what an asset with a rent card carries
 * becomes that card's flags; the rest stays rows. An alert about one
 * contract (the repossession right of driver B) flags only that contract's
 * card — never the card of another driver of the same car; an alert about
 * the car itself (a red line, a silent tracker) flags every card of it.
 * Kinds no card takes stay a row of their own. Flags are keyed by contract.
 */
export function foldIntoCards<G extends UrgentGroup>(
  groups: G[],
  cards: readonly RentCardRef[],
): { rows: G[]; flags: Map<string, string[]> } {
  const flags = new Map<string, string[]>();
  const rows: G[] = [];
  for (const group of groups) {
    const own = group.assetId ? cards.filter((card) => card.assetId === group.assetId) : [];
    if (own.length === 0) {
      rows.push(group);
      continue;
    }
    const left: G["kinds"] = [];
    for (const kind of group.kinds) {
      const alerts = kind.alerts ?? [];
      const general = alerts.length === 0 || alerts.some((alert) => contractOf(alert) == null);
      const ids = new Set(alerts.map(contractOf).filter((id): id is string => id != null));
      const takers = own.filter((card) => general || ids.has(card.contractId));
      for (const card of takers) flags.set(card.contractId, [...(flags.get(card.contractId) ?? []), kind.type]);
      if (general) continue;
      // A contract with no card today (already paid up): its alert stays a row.
      const untaken = alerts.filter((alert) => !own.some((card) => card.contractId === contractOf(alert)));
      if (untaken.length > 0) left.push({ ...kind, alerts: untaken });
    }
    if (left.length > 0) {
      const kept = new Set(left.flatMap((kind) => kind.alerts ?? []));
      const withAlerts = group as G & { alerts?: readonly unknown[] };
      rows.push({
        ...group,
        ...(withAlerts.alerts ? { alerts: withAlerts.alerts.filter((alert) => kept.has(alert as { payload?: unknown })) } : {}),
        kinds: left,
        rank: Math.min(...left.map((kind) => alertRank(kind.type))),
      });
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
