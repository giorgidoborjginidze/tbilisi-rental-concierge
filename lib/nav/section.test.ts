import { describe, expect, it } from "vitest";
import { activeHref, sectionOf } from "./section";
import { navModel } from "./model";

const hrefs = (entries: { href: string }[]) => entries.map((entry) => entry.href);
const hotel = navModel({ profile: "hotel", units: 12 });
const fleet = navModel({ profile: "car_rental", units: 0 });
const TOP = hrefs(hotel.top); // /, /calendar, /assets, /invest, /alerts
const TABS = hrefs(hotel.tabs); // /, /calendar, /assets, /units, /alerts

describe("sectionOf", () => {
  it("maps Rentals sub-pages to Rentals (its landing page, the calendar)", () => {
    for (const path of ["/units", "/units/new", "/calendar", "/bookings/abc/edit", "/pricing", "/analytics"]) {
      expect(sectionOf(path)).toBe("/calendar");
    }
  });

  it("maps deep pages to their first segment", () => {
    expect(sectionOf("/assets/abc/rental")).toBe("/assets");
    expect(sectionOf("/invest/pro")).toBe("/invest");
    expect(sectionOf("/fleet")).toBe("/fleet");
    expect(sectionOf("/")).toBe("/");
    expect(sectionOf("/alerts?view=done")).toBe("/alerts");
  });
});

describe("activeHref", () => {
  it("marks the parent section in the top nav", () => {
    expect(activeHref("/units", TOP)).toBe("/calendar");
    expect(activeHref("/pricing", TOP)).toBe("/calendar");
    expect(activeHref("/analytics", TOP)).toBe("/calendar");
    expect(activeHref("/invest/pro", TOP)).toBe("/invest");
    expect(activeHref("/assets/abc/edit", TOP)).toBe("/assets");
    expect(activeHref("/", TOP)).toBe("/");
  });

  it("the dashboard is current only on the dashboard itself", () => {
    expect(activeHref("/settings", TOP)).toBeNull();
    expect(activeHref("/billing", TOP)).toBeNull();
  });

  it("prefers a seat of its own over the section (tab bar)", () => {
    expect(activeHref("/units", TABS)).toBe("/units");
    expect(activeHref("/units/abc/edit", TABS)).toBe("/units");
    expect(activeHref("/calendar", TABS)).toBe("/calendar");
    expect(activeHref("/bookings", TABS)).toBe("/calendar");
    expect(activeHref("/analytics", TABS)).toBe("/calendar");
    expect(activeHref("/invest", TABS)).toBeNull();
  });

  it("the fleet seat is current on the fleet page; a car's desk is part of Assets", () => {
    expect(activeHref("/fleet", hrefs(fleet.tabs))).toBe("/fleet");
    expect(activeHref("/assets/abc/rental", hrefs(fleet.tabs))).toBe("/assets");
  });

  it("does not match a longer name that only shares a prefix", () => {
    expect(activeHref("/assetsx", ["/assets"])).toBeNull();
  });

  it("gives nothing when the section is not offered (e.g. no Rentals entry)", () => {
    expect(activeHref("/calendar", ["/", "/assets", "/invest", "/alerts"])).toBeNull();
  });
});
