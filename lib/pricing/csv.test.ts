import { describe, expect, it } from "vitest";
import { suggestionsCsv } from "./csv";

describe("suggestionsCsv", () => {
  it("one line per night, quoted where needed, UTF-8 BOM first", () => {
    const csv = suggestionsCsv(["თარიღი", "ფასი", "ვალუტა", "მიზეზი"], [
      { date: "2026-10-01", price: 129, currency: "GEL", reason: "სეზონი ზრდის (×1.10); უბნის საშუალო" },
      { date: "2026-10-02", price: 140, currency: "GEL", reason: 'say "hi", ok' },
    ]);
    expect(csv.startsWith("﻿თარიღი,ფასი,ვალუტა,მიზეზი\r\n")).toBe(true);
    expect(csv).toContain('2026-10-01,129,GEL,"სეზონი ზრდის (×1.10); უბნის საშუალო"');
    expect(csv).toContain('2026-10-02,140,GEL,"say ""hi"", ok"');
  });
});
