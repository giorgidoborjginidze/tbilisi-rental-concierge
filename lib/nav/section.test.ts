import { describe, expect, it } from "vitest";
import { activeHref, sectionOf } from "./section";

const TOP = ["/", "/units", "/assets", "/invest", "/alerts", "/learn", "/about", "/contact"];
const TABS = ["/", "/units", "/assets", "/calendar", "/alerts"];

describe("sectionOf", () => {
  it("maps Rentals sub-pages to Rentals", () => {
    for (const path of ["/units", "/units/new", "/calendar", "/bookings/abc/edit", "/pricing", "/analytics"]) {
      expect(sectionOf(path)).toBe("/units");
    }
  });

  it("maps deep pages to their first segment", () => {
    expect(sectionOf("/assets/abc/rental")).toBe("/assets");
    expect(sectionOf("/invest/pro")).toBe("/invest");
    expect(sectionOf("/")).toBe("/");
    expect(sectionOf("/alerts?view=done")).toBe("/alerts");
  });
});

describe("activeHref", () => {
  it("marks the parent section in the top nav", () => {
    expect(activeHref("/calendar", TOP)).toBe("/units");
    expect(activeHref("/pricing", TOP)).toBe("/units");
    expect(activeHref("/invest/pro", TOP)).toBe("/invest");
    expect(activeHref("/assets/abc/edit", TOP)).toBe("/assets");
    expect(activeHref("/", TOP)).toBe("/");
  });

  it("the dashboard is current only on the dashboard itself", () => {
    expect(activeHref("/settings", TOP)).toBeNull();
    expect(activeHref("/billing", TOP)).toBeNull();
  });

  it("prefers a tab of its own over the section (tab bar)", () => {
    expect(activeHref("/calendar", TABS)).toBe("/calendar");
    expect(activeHref("/bookings", TABS)).toBe("/units");
    expect(activeHref("/analytics", TABS)).toBe("/units");
    expect(activeHref("/invest", TABS)).toBeNull();
  });

  it("does not match a longer name that only shares a prefix", () => {
    expect(activeHref("/assetsx", ["/assets"])).toBeNull();
  });

  it("gives nothing when the section is not offered (e.g. no Rentals entry)", () => {
    expect(activeHref("/calendar", ["/", "/assets", "/invest", "/alerts"])).toBeNull();
  });
});
