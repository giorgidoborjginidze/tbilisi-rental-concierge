import { describe, expect, it } from "vitest";
import { foldIntoCards, rentCardRank, todaySegments } from "./today";
import { alertRank } from "@/lib/alerts/rank";

describe("rentCardRank", () => {
  it("past the grace period or outside a red line is as loud as the repossession right", () => {
    expect(rentCardRank({ severe: true, flags: [] })).toBe(alertRank("repossession_right"));
    expect(rentCardRank({ severe: false, flags: ["geofence_breach"] })).toBe(alertRank("geofence_breach"));
    expect(rentCardRank({ severe: false, flags: ["tracker_silent"] })).toBe(alertRank("tracker_silent"));
    expect(rentCardRank({ severe: false, flags: [] })).toBe(alertRank("rent_overdue"));
  });

  it("takes the most severe thing the card carries — a double booking outranks everything", () => {
    expect(rentCardRank({ severe: false, flags: ["overlap"] })).toBe(alertRank("overlap"));
    expect(rentCardRank({ severe: true, flags: ["overlap"] })).toBe(alertRank("overlap"));
    expect(rentCardRank({ severe: true, flags: ["tracker_silent"] })).toBe(alertRank("repossession_right"));
  });

  it("a folded double booking sorts its car first, ahead of cars owing more periods", () => {
    const groups = [
      { assetId: "carA", rank: alertRank("overlap"), kinds: [{ type: "overlap" }] },
      { assetId: "carF", rank: alertRank("tracker_silent"), kinds: [{ type: "tracker_silent" }] },
    ];
    const cards = ["carA", "carB", "carC", "carD", "carE"].map((assetId, i) => ({
      assetId,
      contractId: `c-${assetId}`,
      severe: false,
      periodsOwed: assetId === "carA" ? 1 : 5 - i,
    }));
    const { rows, flags } = foldIntoCards(groups, cards);
    const rankOf = (card: (typeof cards)[number]) =>
      rentCardRank({ severe: card.severe, flags: flags.get(card.contractId) ?? [] });
    const segments = todaySegments(rows, cards, rankOf);
    expect(segments[0].kind).toBe("cards");
    expect((segments[0].items[0] as { assetId: string }).assetId).toBe("carA");
    // The silent tracker of a paid-up car comes after the double booking,
    // before the plain due-today cards.
    expect(segments.map((s) => s.kind)).toEqual(["cards", "rows", "cards"]);
  });
});

describe("foldIntoCards", () => {
  it("a late car's red line and silent tracker ride on its rent card; other places stay rows", () => {
    const groups = [
      { assetId: "prius", rank: 1, kinds: [{ type: "geofence_breach" }, { type: "repossession_right" }] },
      { assetId: "camry", rank: 2, kinds: [{ type: "tracker_silent" }] },
      { assetId: null, rank: 0, kinds: [{ type: "overlap" }] },
    ];
    const { rows, flags } = foldIntoCards(groups, [{ assetId: "prius", contractId: "k1" }]);
    expect(rows.map((row) => row.assetId)).toEqual(["camry", null]);
    expect(flags.get("k1")).toEqual(["geofence_breach", "repossession_right"]);
  });

  it("a contract's alert flags only that contract's card; the car's own alert flags every card of it", () => {
    const groups = [
      {
        assetId: "car",
        rank: 1,
        kinds: [
          { type: "repossession_right", alerts: [{ payload: { assetId: "car", contractId: "second" } }] },
          { type: "geofence_breach", alerts: [{ payload: { assetId: "car" } }] },
        ],
      },
    ];
    const { rows, flags } = foldIntoCards(groups, [
      { assetId: "car", contractId: "first" },
      { assetId: "car", contractId: "second" },
    ]);
    expect(rows).toEqual([]);
    expect(flags.get("first")).toEqual(["geofence_breach"]);
    expect(flags.get("second")).toEqual(["repossession_right", "geofence_breach"]);
  });

  it("an alert of a contract with no card today stays a row with only that kind", () => {
    const alert = { payload: { assetId: "car", contractId: "paidUp" } };
    const groups = [
      {
        assetId: "car",
        rank: 1,
        alerts: [alert],
        kinds: [{ type: "repossession_right", alerts: [alert] }],
      },
    ];
    const { rows, flags } = foldIntoCards(groups, [{ assetId: "car", contractId: "other" }]);
    expect(flags.get("other")).toBeUndefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].kinds.map((k) => k.type)).toEqual(["repossession_right"]);
  });
});

describe("todaySegments", () => {
  const byRank = (card: { rank: number }) => card.rank;
  it("cards of rank 1 and 3 with a row of rank 2: the row sits between them", () => {
    const segments = todaySegments([{ rank: 2, id: "silent" }], [{ rank: 3, id: "due" }, { rank: 1, id: "repossess" }], byRank);
    expect(segments).toEqual([
      { kind: "cards", items: [{ rank: 1, id: "repossess" }] },
      { kind: "rows", items: [{ rank: 2, id: "silent" }] },
      { kind: "cards", items: [{ rank: 3, id: "due" }] },
    ]);
  });

  it("a row goes before a card of the same rank; neighbours of one kind stay one block", () => {
    const segments = todaySegments(
      [{ rank: 0 }, { rank: 1 }],
      [{ rank: 1 }, { rank: 3 }, { rank: 3 }],
      byRank,
    );
    expect(segments.map((s) => [s.kind, s.items.length])).toEqual([
      ["rows", 2],
      ["cards", 3],
    ]);
  });

  it("no cards: one block of rows; no rows: one block of cards; nothing: nothing", () => {
    expect(todaySegments([{ rank: 2 }, { rank: 0 }], [], byRank)).toEqual([
      { kind: "rows", items: [{ rank: 0 }, { rank: 2 }] },
    ]);
    expect(todaySegments([], [{ rank: 3 }], byRank)).toEqual([{ kind: "cards", items: [{ rank: 3 }] }]);
    expect(todaySegments([], [], byRank)).toEqual([]);
  });
});
