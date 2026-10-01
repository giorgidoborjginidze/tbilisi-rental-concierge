import { describe, expect, it } from "vitest";
import { stubRationale } from "./rationale";
import { suggestRate } from "@/lib/pricing/engine";

const date = new Date("2026-10-14T00:00:00Z"); // a Wednesday, mid-month
const october = suggestRate({
  baseNightlyRate: 130,
  city: "Batumi",
  date,
  upcomingOccupancy: 0.6,
  benchmarkAdr: 135,
});
const context = { unitName: "Sea view", district: "Batumi Boulevard", city: "Batumi", baseNightlyRate: 130 };

describe("stubRationale", () => {
  it("says which force lowered the price and which pulled it up (ka)", () => {
    const text = stubRationale({ date, result: october, currency: "GEL" }, { ...context, locale: "ka" });
    expect(text).toBe("საბაზოზე დაბალი: დაბალი სეზონი ამცირებს (×0.90); უბნის საშუალო (135 ₾) ზემოთ სწევს.");
    expect(text).not.toContain("ჯერ კიდევ");
  });

  it("does the same in English", () => {
    const text = stubRationale({ date, result: october, currency: "GEL" }, { ...context, locale: "en" });
    expect(text).toBe("Below base: the low season lowers it (×0.90); the district average (135 ₾) pulls it up.");
  });
});
