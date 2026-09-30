import { describe, expect, it } from "vitest";
import { ADVICE_TYPES, alertDay, NEEDS_YOU_TYPES, rankAlerts, URGENT_TYPES } from "./rank";

const at = (iso: string) => new Date(iso);

describe("alert order", () => {
  it("puts double bookings and the repossession right first, a price to raise before free windows", () => {
    const ranked = rankAlerts([
      { type: "vacancy_gap", createdAt: at("2026-09-30T09:00:00Z") },
      { type: "underpriced", createdAt: at("2026-09-30T10:00:00Z") },
      { type: "repossession_right", createdAt: at("2026-09-29T09:00:00Z") },
      { type: "vacancy_gap", createdAt: at("2026-09-30T11:00:00Z") },
      { type: "overlap", createdAt: at("2026-09-01T09:00:00Z") },
      { type: "rent_overdue", createdAt: at("2026-09-30T09:00:00Z") },
    ]);
    expect(ranked.map((a) => a.type)).toEqual([
      "overlap",
      "repossession_right",
      "rent_overdue",
      "underpriced",
      "vacancy_gap",
      "vacancy_gap",
    ]);
    // Without a day to compare, the newest first among equals.
    expect(ranked[4].createdAt).toEqual(at("2026-09-30T11:00:00Z"));
  });

  it("among equals the soonest day comes first, whenever the alert was raised", () => {
    const ranked = rankAlerts([
      { type: "vacancy_gap", createdAt: at("2026-09-30T12:00:00Z"), payload: { start: "2026-10-27" } },
      { type: "vacancy_gap", createdAt: at("2026-09-30T11:00:00Z"), payload: { start: "2026-10-21" } },
      { type: "vacancy_gap", createdAt: at("2026-09-30T10:00:00Z"), payload: { start: "2026-10-04" } },
      { type: "vacancy_gap", createdAt: at("2026-09-30T13:00:00Z"), payload: {} },
    ]);
    expect(ranked.map((a) => alertDay(a.payload))).toEqual(["2026-10-04", "2026-10-21", "2026-10-27", null]);
  });
});

describe("alertDay", () => {
  it("reads the day an alert is about", () => {
    expect(alertDay({ start: "2026-10-04", end: "2026-10-09" })).toBe("2026-10-04");
    expect(alertDay({ dueDate: "2026-09-28" })).toBe("2026-09-28");
    expect(alertDay({ endDate: "2026-11-01" })).toBe("2026-11-01");
    expect(alertDay({ month: "2026-10" })).toBe("2026-10-01");
    expect(alertDay({ key: "x" })).toBeNull();
    expect(alertDay(null)).toBeNull();
  });
});

describe("alert kinds", () => {
  it("every kind is either urgent, late rent or advice — none is shown twice on the dashboard", () => {
    const all = [...URGENT_TYPES, "rent_overdue", ...ADVICE_TYPES];
    expect(new Set(all).size).toBe(all.length);
    for (const type of URGENT_TYPES) expect(NEEDS_YOU_TYPES).toContain(type);
    expect(NEEDS_YOU_TYPES).toContain("rent_overdue");
    for (const type of ADVICE_TYPES) expect(NEEDS_YOU_TYPES).not.toContain(type);
  });
});
