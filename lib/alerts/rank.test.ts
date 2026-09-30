import { describe, expect, it } from "vitest";
import { rankAlerts } from "./rank";

const at = (iso: string) => new Date(iso);

describe("alert order", () => {
  it("puts double bookings and the repossession right before advice, newest first among equals", () => {
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
      "vacancy_gap",
      "vacancy_gap",
      "underpriced",
    ]);
    expect(ranked[3].createdAt).toEqual(at("2026-09-30T11:00:00Z"));
  });
});
