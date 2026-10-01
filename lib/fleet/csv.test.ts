import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";
import { asFleetSort, sortFleet } from "./rows";

describe("fleet spreadsheet", () => {
  it("quotes, escapes and defuses formulas", () => {
    expect(csvCell('Prius, "white"')).toBe('"Prius, ""white"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-120)).toBe("-120");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["მანქანა", 1], ["a", null]])).toBe("﻿მანქანა,1\r\na,\r\n");
  });

  it("sorts by what the owner asks", () => {
    const row = (name: string, rank: number, owed: number, end: string | null, ping: string | null) => ({
      rank,
      vehicle: { name },
      owes: owed > 0,
      status: owed > 0 ? { amountDue: owed } : null,
      running: end ? { endDate: new Date(end) } : null,
      lastPingAt: ping ? new Date(ping) : null,
    });
    const rows = [row("B", 2, 0, "2026-12-01", "2026-10-01"), row("A", 1, 50, null, null), row("C", 0, 300, "2026-11-01", "2026-09-01")];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = (sort: string) => sortFleet(rows as any, asFleetSort(sort)).map((r) => r.vehicle.name);
    expect(names("urgent")).toEqual(["C", "A", "B"]);
    expect(names("name")).toEqual(["A", "B", "C"]);
    expect(names("owed")).toEqual(["C", "A", "B"]);
    expect(names("end")).toEqual(["C", "B", "A"]);
    expect(names("ping")).toEqual(["C", "B", "A"]);
    expect(asFleetSort("bogus")).toBe("urgent");
  });
});
