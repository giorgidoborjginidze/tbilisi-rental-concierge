import { describe, expect, it } from "vitest";
import { adviceTips, alertPlace, groupAlerts, type GroupableAlert } from "./groups";
import { ADVICE_TYPES } from "./rank";

let n = 0;
const alert = (type: string, extra: Partial<GroupableAlert> = {}): GroupableAlert => ({
  id: `al${++n}`,
  type,
  createdAt: new Date("2026-09-30T08:00:00Z"),
  unitId: null,
  payload: {},
  ...extra,
});

describe("groupAlerts", () => {
  it("one group per place; the most severe group first; kinds inside in the same order", () => {
    const groups = groupAlerts([
      alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-27" } }),
      alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-04" } }),
      alert("underpriced", { unitId: "vake", payload: { month: "2026-10" } }),
      alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-21" } }),
      alert("geofence_breach", { payload: { assetId: "prius" } }),
      alert("rent_overdue", { payload: { assetId: "prius", dueDate: "2026-09-22" } }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["a-prius", "u-vake", "u-orbi"]);
    expect(groups[0].kinds.map((k) => k.type)).toEqual(["geofence_breach", "rent_overdue"]);
    const orbi = groups[2];
    expect(orbi.kinds).toHaveLength(1);
    expect(orbi.alerts.map((a) => (a.payload as { start: string }).start)).toEqual([
      "2026-10-04",
      "2026-10-21",
      "2026-10-27",
    ]);
    expect(orbi.day).toBe("2026-10-04");
  });

  it("a unit and the asset linked to it are one place", () => {
    const groups = groupAlerts(
      [
        alert("vacancy_gap", { unitId: "u1", payload: { start: "2026-10-04" } }),
        alert("overlap", { payload: { assetId: "flat1", start: "2026-10-10" } }),
      ],
      new Map([["flat1", "u1"]]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "u-u1", unitId: "u1", assetId: "flat1", rank: 0 });
  });

  it("an alert naming no place stands alone", () => {
    const lone = alert("contract_expiry");
    expect(alertPlace(lone).key).toBe(`x-${lone.id}`);
  });

  it("equal groups: the soonest day first", () => {
    const groups = groupAlerts([
      alert("vacancy_gap", { unitId: "late", payload: { start: "2026-10-12" } }),
      alert("vacancy_gap", { unitId: "soon", payload: { start: "2026-10-02" } }),
    ]);
    expect(groups.map((g) => g.unitId)).toEqual(["soon", "late"]);
  });
});

describe("adviceTips", () => {
  it("one tip per kind per place, urgent kinds left out, a price to raise first", () => {
    const tips = adviceTips(
      [
        alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-27" } }),
        alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-04" } }),
        alert("vacancy_gap", { unitId: "orbi", payload: { start: "2026-10-21" } }),
        alert("vacancy_gap", { unitId: "vera", payload: { start: "2026-10-02" } }),
        alert("underpriced", { unitId: "vake", payload: { month: "2026-10" } }),
        alert("repossession_right", { payload: { assetId: "prius" } }),
        alert("contract_expiry", { payload: { assetId: "flat", endDate: "2026-10-15" } }),
      ],
      ADVICE_TYPES,
    );
    expect(tips.map((tip) => tip.key)).toEqual([
      "contract_expiry:a-flat",
      "underpriced:u-vake",
      "vacancy_gap:u-vera",
      "vacancy_gap:u-orbi",
    ]);
    const orbi = tips[3];
    expect(orbi.alerts).toHaveLength(3);
    expect((orbi.alerts[0].payload as { start: string }).start).toBe("2026-10-04");
  });
});
