import { describe, expect, it } from "vitest";
import { aroundCards, foldIntoCards, rentCardRank } from "./today";
import { alertRank } from "@/lib/alerts/rank";

describe("rentCardRank", () => {
  it("past the grace period or outside a red line is as loud as the repossession right", () => {
    expect(rentCardRank({ severe: true, flags: [] })).toBe(alertRank("repossession_right"));
    expect(rentCardRank({ severe: false, flags: ["geofence_breach"] })).toBe(alertRank("geofence_breach"));
    expect(rentCardRank({ severe: false, flags: ["tracker_silent"] })).toBe(alertRank("tracker_silent"));
    expect(rentCardRank({ severe: false, flags: [] })).toBe(alertRank("rent_overdue"));
  });
});

describe("foldIntoCards", () => {
  it("a late car's red line and silent tracker ride on its rent card; other places stay rows", () => {
    const groups = [
      { assetId: "prius", rank: 1, kinds: [{ type: "geofence_breach" }, { type: "repossession_right" }] },
      { assetId: "camry", rank: 2, kinds: [{ type: "tracker_silent" }] },
      { assetId: null, rank: 0, kinds: [{ type: "overlap" }] },
    ];
    const { rows, flags } = foldIntoCards(groups, new Set(["prius"]));
    expect(rows.map((row) => row.assetId)).toEqual(["camry", null]);
    expect(flags.get("prius")).toEqual(["geofence_breach", "repossession_right"]);
  });
});

describe("aroundCards", () => {
  const rows = [{ rank: 0 }, { rank: 1 }, { rank: 2 }];
  it("rows as severe as the worst card or worse come first, the rest after the cards", () => {
    expect(aroundCards(rows, 1)).toEqual({ before: [{ rank: 0 }, { rank: 1 }], after: [{ rank: 2 }] });
    expect(aroundCards(rows, 3)).toEqual({ before: rows, after: [] });
  });
  it("no cards: every row", () => {
    expect(aroundCards(rows, null)).toEqual({ before: rows, after: [] });
  });
});
