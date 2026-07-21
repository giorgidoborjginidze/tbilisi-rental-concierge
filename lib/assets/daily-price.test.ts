import { describe, expect, it } from "vitest";
import { dayKind, dayPrice, isHoliday, isWeekend } from "./daily-price";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("day classification", () => {
  it("detects weekends", () => {
    expect(isWeekend(utc(2026, 7, 25))).toBe(true); // Saturday
    expect(isWeekend(utc(2026, 7, 26))).toBe(true); // Sunday
    expect(isWeekend(utc(2026, 7, 27))).toBe(false); // Monday
  });

  it("detects fixed Georgian holidays", () => {
    expect(isHoliday(utc(2026, 5, 26))).toBe(true); // Independence Day
    expect(isHoliday(utc(2026, 11, 23))).toBe(true); // Giorgoba
    expect(isHoliday(utc(2026, 7, 21))).toBe(false);
  });

  it("holiday wins over weekend", () => {
    // 26 May 2029 is a Saturday and Independence Day.
    expect(dayKind(utc(2029, 5, 26))).toBe("holiday");
  });
});

describe("dayPrice", () => {
  it("charges the base rate on a weekday", () => {
    expect(dayPrice(utc(2026, 7, 21), 90, 20, 30)).toBe(90); // Tuesday
  });

  it("applies the weekend premium", () => {
    expect(dayPrice(utc(2026, 7, 25), 90, 20, 30)).toBe(108); // Saturday
  });

  it("applies the holiday premium", () => {
    expect(dayPrice(utc(2026, 5, 26), 100, 20, 30)).toBe(130);
  });

  it("rounds to whole GEL", () => {
    expect(dayPrice(utc(2026, 7, 25), 95, 15, 30)).toBe(109); // 109.25 → 109
  });
});
