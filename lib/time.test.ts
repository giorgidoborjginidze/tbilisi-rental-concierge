import { describe, expect, it } from "vitest";
import {
  hourTbilisi,
  monthStartTbilisi,
  sameTbilisiDay,
  startOfTodayTbilisi,
  tbilisiDayStartInstant,
  tbilisiFormat,
  todayKey,
} from "./time";

describe("Tbilisi today", () => {
  it("began at local midnight, 20:00 UTC the evening before", () => {
    expect(tbilisiDayStartInstant(new Date("2026-09-30T06:38:12Z"))).toEqual(
      new Date("2026-09-29T20:00:00Z"),
    );
    // 23:30 local on the 30th is still the 30th; 00:10 local is the 1st.
    expect(tbilisiDayStartInstant(new Date("2026-09-30T19:30:00Z"))).toEqual(
      new Date("2026-09-29T20:00:00Z"),
    );
    expect(tbilisiDayStartInstant(new Date("2026-09-30T20:10:00Z"))).toEqual(
      new Date("2026-09-30T20:00:00Z"),
    );
  });

  it("has already moved on at 01:30 local time while UTC is still yesterday", () => {
    // Saturday 3 October, 01:30 in Tbilisi = Friday 21:30 UTC.
    const now = new Date("2026-10-02T21:30:00Z");
    expect(todayKey(now)).toBe("2026-10-03");
    expect(startOfTodayTbilisi(now)).toEqual(new Date("2026-10-03T00:00:00Z"));
  });

  it("is still today at 23:59 local time", () => {
    expect(todayKey(new Date("2026-09-30T19:59:00Z"))).toBe("2026-09-30");
    expect(todayKey(new Date("2026-09-30T20:00:00Z"))).toBe("2026-10-01");
  });

  it("gives the local hour and month", () => {
    expect(hourTbilisi(new Date("2026-09-30T06:38:00Z"))).toBe(10);
    expect(monthStartTbilisi(0, new Date("2026-09-30T21:00:00Z"))).toEqual(
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(monthStartTbilisi(-5, new Date("2026-09-15T12:00:00Z"))).toEqual(
      new Date("2026-04-01T00:00:00Z"),
    );
  });

  it("compares calendar days in Tbilisi", () => {
    expect(
      sameTbilisiDay(new Date("2026-09-30T20:30:00Z"), new Date("2026-10-01T10:00:00Z")),
    ).toBe(true);
  });
});

describe("tbilisiFormat", () => {
  it("shows a GPS ping in local wall-clock time, not UTC", () => {
    const fmt = tbilisiFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(fmt.format(new Date("2026-09-30T06:38:00Z"))).toBe("10:38");
  });

  it("keeps a stored calendar day on its own date", () => {
    const fmt = tbilisiFormat("en", { day: "numeric", month: "short", year: "numeric" });
    expect(fmt.format(new Date("2026-08-10T00:00:00Z"))).toBe("10 Aug 2026");
  });
});
