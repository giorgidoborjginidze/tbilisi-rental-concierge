import { describe, expect, it } from "vitest";
import { asChannel, buildIcs, staysFor, type BusyStay } from "./export";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const stays: BusyStay[] = [
  { id: "b1", kind: "airbnb", start: d("2026-10-03"), end: d("2026-10-06") },
  { id: "b2", kind: "booking", start: d("2026-10-10"), end: d("2026-10-12") },
  { id: "c1", kind: "contract", start: d("2026-11-01"), end: d("2027-11-01") },
];

describe("calendar export", () => {
  it("leaves out each channel's own stays", () => {
    expect(staysFor(stays, "airbnb").map((s) => s.id)).toEqual(["b2", "c1"]);
    expect(staysFor(stays, "booking").map((s) => s.id)).toEqual(["b1", "c1"]);
    expect(staysFor(stays, asChannel("other"))).toHaveLength(3);
  });

  it("writes all-day busy events with stable ids and no personal data", () => {
    const ics = buildIcs({ name: "Vake 2BR", stays, now: new Date("2026-10-01T08:00:00Z") });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261003\r\nDTEND;VALUE=DATE:20261006");
    expect(ics).toContain("UID:b1@activo.world");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines and escapes text", () => {
    const ics = buildIcs({ name: "A, very; long name ".repeat(6), stays: [], now: new Date() });
    const line = ics.split("\r\n").find((l) => l.startsWith("X-WR-CALNAME"))!;
    expect(line).toContain("\\,");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
