import { describe, expect, it } from "vitest";
import { assetFromUnit, namePairs, unitFromAsset, wantsUnit } from "./link";

describe("namePairs (the one-off backfill)", () => {
  const unit = (id: string, name: string, operatorId = "op1") => ({ id, name, operatorId });
  const asset = unit;

  it("links a unit and an asset with an identical name in the same workspace", () => {
    expect(namePairs([unit("u1", "Vake 2BR")], [asset("a1", "Vake 2BR")])).toEqual([
      { unitId: "u1", assetId: "a1" },
    ]);
  });

  it("links nothing else: other spelling, other workspace, or a name used twice", () => {
    expect(namePairs([unit("u1", "Vake 2BR")], [asset("a1", "Vake 2BR (short-term)")])).toEqual([]);
    expect(namePairs([unit("u1", "Vake 2BR")], [asset("a1", "vake 2br")])).toEqual([]);
    expect(namePairs([unit("u1", "Vake 2BR")], [asset("a1", "Vake 2BR ")])).toEqual([]);
    expect(namePairs([unit("u1", "Vake 2BR", "op1")], [asset("a1", "Vake 2BR", "op2")])).toEqual([]);
    expect(
      namePairs([unit("u1", "Studio"), unit("u2", "Studio")], [asset("a1", "Studio")]),
    ).toEqual([]);
    expect(
      namePairs([unit("u1", "Studio")], [asset("a1", "Studio"), asset("a2", "Studio")]),
    ).toEqual([]);
    expect(namePairs([unit("u1", "")], [asset("a1", "")])).toEqual([]);
  });
});

describe("the other side of a new property", () => {
  it("a new unit's asset is real estate let by the day, with no value yet", () => {
    const made = assetFromUnit({
      operatorId: "op1",
      id: "u1",
      name: "Old Town Studio",
      nameKa: "ძველი ქალაქის სტუდია",
      city: "Tbilisi",
      district: "Old Town",
      address: "3 Shardeni St",
      type: "aparthotel_room",
      baseNightlyRate: 140,
      currency: "GEL",
      channelLinks: { airbnbUrl: "https://airbnb.com/rooms/1", bookingUrl: null, icalUrls: [] },
    });
    expect(made).toMatchObject({
      unitId: "u1",
      category: "real_estate",
      type: "apartment",
      rentalMode: "daily",
      estimatedValue: null,
      dailyRate: 140,
      airbnbUrl: "https://airbnb.com/rooms/1",
      district: "Old Town",
    });
  });

  it("an asset's unit takes its day rate, else the district's average night, else none", () => {
    const base = {
      name: "Nino's flat",
      nameKa: null,
      city: null,
      district: "Vake",
      address: null,
      type: "house",
      dailyRate: 90,
      currency: "GEL",
      airbnbUrl: null,
      bookingUrl: null,
    };
    expect(unitFromAsset(base, ["https://www.airbnb.com/calendar/ical/1.ics"], 150)).toMatchObject({
      city: "Tbilisi",
      district: "Vake",
      address: "",
      type: "house",
      baseNightlyRate: 90,
      channelLinks: { icalUrls: ["https://www.airbnb.com/calendar/ical/1.ics"] },
    });
    expect(unitFromAsset({ ...base, dailyRate: null }, [], 149.6).baseNightlyRate).toBe(150);
    expect(unitFromAsset({ ...base, dailyRate: null }, [], null).baseNightlyRate).toBe(0);
    expect(unitFromAsset({ ...base, type: "garage" }, [], null).type).toBe("apartment");
  });

  it("only a real-estate asset let by the day, or given iCal links, gets a unit", () => {
    expect(wantsUnit({ category: "real_estate", rentalMode: "daily", icalCount: 0 })).toBe(true);
    expect(wantsUnit({ category: "real_estate", rentalMode: "long_term", icalCount: 1 })).toBe(true);
    expect(wantsUnit({ category: "real_estate", rentalMode: "long_term", icalCount: 0 })).toBe(false);
    expect(wantsUnit({ category: "vehicle", rentalMode: "daily", icalCount: 0 })).toBe(false);
  });
});
