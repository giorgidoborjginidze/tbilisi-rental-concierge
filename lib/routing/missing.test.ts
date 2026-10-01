import { describe, expect, it } from "vitest";
import { detailRecord } from "./missing";

describe("detailRecord (proxy.ts's real 404s)", () => {
  it("reads the record a detail page is about", () => {
    expect(detailRecord("/assets/abc/edit")).toEqual({ kind: "asset", id: "abc" });
    expect(detailRecord("/assets/abc/rental")).toEqual({ kind: "asset", id: "abc" });
    expect(detailRecord("/units/u1/edit/")).toEqual({ kind: "unit", id: "u1" });
    expect(detailRecord("/bookings/b1/edit")).toEqual({ kind: "booking", id: "b1" });
  });

  it("leaves every other page alone", () => {
    expect(detailRecord("/assets")).toBeNull();
    expect(detailRecord("/assets/new")).toBeNull();
    expect(detailRecord("/assets/abc/edit/extra")).toBeNull();
    expect(detailRecord("/units/new")).toBeNull();
  });
});
