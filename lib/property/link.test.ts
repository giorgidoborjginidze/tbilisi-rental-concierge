import { describe, expect, it } from "vitest";
import {
  asksDailyQuestion,
  assetFromUnit,
  icalLinksAdded,
  namePairs,
  shouldCreateUnit,
  suggestAssetFor,
  unitFeedsAfterSave,
  unitFromAsset,
  wantsUnit,
} from "./link";

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

describe("a flat joins the calendar only at a change that puts it there (shouldCreateUnit)", () => {
  const flat = { category: "real_estate", rentalMode: "daily", pickedUnitId: null, addedIcal: 0 };

  it("a new day-let flat, or one given iCal links, gets its unit; a long let does not", () => {
    expect(shouldCreateUnit({ ...flat, previous: null })).toBe(true);
    expect(shouldCreateUnit({ ...flat, rentalMode: "long_term", previous: null })).toBe(false);
    expect(shouldCreateUnit({ ...flat, rentalMode: "long_term", previous: null, addedIcal: 1 })).toBe(true);
    expect(shouldCreateUnit({ ...flat, category: "vehicle", previous: null })).toBe(false);
  });

  it("never while a unit is picked", () => {
    expect(shouldCreateUnit({ ...flat, pickedUnitId: "u1", previous: null })).toBe(false);
  });

  it("an existing flat: only when it moves into daily mode or gains links", () => {
    const longLet = { rentalMode: "long_term", unitId: null };
    const dayLet = { rentalMode: "daily", unitId: null };
    expect(shouldCreateUnit({ ...flat, previous: longLet })).toBe(true);
    expect(shouldCreateUnit({ ...flat, rentalMode: "long_term", previous: longLet, addedIcal: 2 })).toBe(true);
    // The owner removed the link earlier: a later save (a new rate, notes)
    // must not make a second unit for the same flat.
    expect(shouldCreateUnit({ ...flat, previous: dayLet })).toBe(false);
  });

  it("not in the save that removes the link by hand", () => {
    expect(shouldCreateUnit({ ...flat, previous: { rentalMode: "daily", unitId: "u1" } })).toBe(false);
    expect(
      shouldCreateUnit({ ...flat, previous: { rentalMode: "long_term", unitId: "u1" }, addedIcal: 1 }),
    ).toBe(false);
  });
});

describe("iCal links typed on an asset go to the unit they were shown for (unitFeedsAfterSave)", () => {
  const A = "https://www.airbnb.com/calendar/ical/1.ics";
  const B = "https://ical.booking.com/v1/export?t=2";
  const C = "https://www.airbnb.com/calendar/ical/3.ics";

  it("the linked unit's own list is replaced by what is typed (a removed line removes the link)", () => {
    expect(unitFeedsAfterSave({ unitId: "u1", shownFor: "u1", shown: [A, B], typed: [A], current: [A, B] })).toEqual([A]);
    expect(unitFeedsAfterSave({ unitId: "u1", shownFor: "u1", shown: [A], typed: [A], current: [A] })).toBeNull();
  });

  it("linking an existing unit with the textarea left empty keeps its feeds", () => {
    expect(unitFeedsAfterSave({ unitId: "u2", shownFor: null, shown: [], typed: [], current: [A, B] })).toBeNull();
  });

  it("switching to another unit never copies the old unit's links nor drops the new one's", () => {
    // The textarea still holds U1's links, untouched.
    expect(unitFeedsAfterSave({ unitId: "u2", shownFor: "u1", shown: [A], typed: [A], current: [B] })).toBeNull();
    // A line typed during the switch is added to U2's own.
    expect(unitFeedsAfterSave({ unitId: "u2", shownFor: "u1", shown: [A], typed: [A, C], current: [B] })).toEqual([
      B,
      C,
    ]);
  });

  it("the links added are the lines that were not shown", () => {
    expect(icalLinksAdded([A, C], [A])).toEqual([C]);
    expect(icalLinksAdded([], [A])).toEqual([]);
  });
});

describe("the daily 'rented today?' question (asksDailyQuestion)", () => {
  it("asks about loose day-let flats and linked units without feeds, not channel-synced rooms", () => {
    expect(asksDailyQuestion({ rentalMode: "daily", unit: null })).toBe(true);
    expect(asksDailyQuestion({ rentalMode: "daily", unit: { channelLinks: { icalUrls: [] } } })).toBe(true);
    expect(
      asksDailyQuestion({ rentalMode: "daily", unit: { channelLinks: { icalUrls: ["https://x/1.ics"] } } }),
    ).toBe(false);
    expect(asksDailyQuestion({ rentalMode: "long_term", unit: null })).toBe(false);
  });

  it("does not ask about a room whose calendar is kept by hand (it has bookings)", () => {
    expect(asksDailyQuestion({ rentalMode: "daily", unit: { channelLinks: null, bookings: 3 } })).toBe(false);
    expect(asksDailyQuestion({ rentalMode: "daily", unit: { channelLinks: null, bookings: 0 } })).toBe(true);
  });
});

describe("the 'same flat?' offer on /units (suggestAssetFor)", () => {
  const assets = [
    { id: "a1", name: "Saburtalo studio", nameKa: null, city: "Tbilisi", district: "Saburtalo" },
    { id: "a2", name: "Vake Park view", nameKa: "ვაკის პარკის ხედი", city: "Tbilisi", district: "Vake" },
    { id: "a3", name: "Batumi sea view", nameKa: null, city: "Batumi", district: "Old Batumi" },
  ];

  it("prefers the same district, then shared words", () => {
    expect(suggestAssetFor({ name: "Room 2", city: "Tbilisi", district: "Vake" }, assets)).toBe("a2");
    expect(
      suggestAssetFor({ name: "Sea view", nameKa: null, city: "Batumi", district: "Old Batumi" }, assets),
    ).toBe("a3");
  });

  it("matches Georgian names too", () => {
    expect(
      suggestAssetFor({ name: "Unit 7", nameKa: "პარკის ხედი", city: "", district: "" }, assets),
    ).toBe("a2");
  });

  it("suggests nothing when nothing matches", () => {
    expect(suggestAssetFor({ name: "Kutaisi loft", city: "Kutaisi", district: "Center" }, assets)).toBeNull();
  });
});
