import { describe, expect, it } from "vitest";
import { parseStayDates } from "./dates";

describe("parseStayDates", () => {
  it("reads two calendar days as nights", () => {
    expect(parseStayDates("2026-10-02", "2026-10-05")).toEqual({
      checkIn: new Date("2026-10-02T00:00:00Z"),
      checkOut: new Date("2026-10-05T00:00:00Z"),
      nights: 3,
    });
  });

  it("refuses empty, impossible, reversed and absurd stays", () => {
    expect(parseStayDates("", "2026-10-05")).toBeNull();
    expect(parseStayDates("2026-02-31", "2026-03-02")).toBeNull();
    expect(parseStayDates("2026-10-05", "2026-10-05")).toBeNull();
    expect(parseStayDates("2026-10-05", "2026-10-02")).toBeNull();
    expect(parseStayDates("2026-10-05", "2036-10-05")).toBeNull();
    expect(parseStayDates("05.10.2026", "07.10.2026")).toBeNull();
  });
});
