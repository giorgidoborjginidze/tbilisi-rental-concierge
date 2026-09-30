import { describe, expect, it } from "vitest";
import { navModel, primaryModule, tourStops } from "./model";

const hrefs = (entries: { href: string }[]) => entries.map((entry) => entry.href);

describe("navModel", () => {
  it("hotel: rentals in the top nav; calendar and units on the phone", () => {
    const model = navModel({ profile: "hotel", units: 12 });
    expect(model.primary).toBe("rentals");
    expect(hrefs(model.top)).toEqual(["/", "/calendar", "/assets", "/invest", "/alerts"]);
    expect(hrefs(model.tabs)).toEqual(["/", "/calendar", "/assets", "/units", "/alerts"]);
    // Invest is the one top-nav entry the tab bar lacks.
    expect(hrefs(model.menuMobile)).toEqual(["/invest"]);
    expect(model.menuAlways).toEqual([]);
  });

  it("car rental: a fleet seat and the calculator, never the hotel calendar", () => {
    const model = navModel({ profile: "car_rental", units: 0 });
    expect(model.primary).toBe("fleet");
    expect(hrefs(model.top)).toEqual(["/", "/fleet", "/assets", "/invest", "/alerts"]);
    expect(hrefs(model.tabs)).toEqual(["/", "/fleet", "/assets", "/invest", "/alerts"]);
    expect(hrefs(model.tabs)).not.toContain("/units");
    expect(hrefs(model.tabs)).not.toContain("/calendar");
    expect(model.menuMobile).toEqual([]);
  });

  it("car rental that also has units keeps its calendar in the account menu", () => {
    const model = navModel({ profile: "car_rental", units: 2 });
    expect(hrefs(model.top)).toHaveLength(5);
    expect(hrefs(model.menuAlways)).toEqual(["/calendar"]);
    expect(hrefs(model.menuMobile)).toEqual(["/calendar"]);
  });

  it("personal or brokerage without units: invest seat and a menu seat", () => {
    for (const profile of ["personal", "brokerage"]) {
      const model = navModel({ profile, units: 0 });
      expect(model.primary).toBeNull();
      expect(hrefs(model.top)).toEqual(["/", "/assets", "/invest", "/alerts"]);
      expect(model.tabs.map((seat) => seat.key)).toEqual(["home", "invest", "assets", "alerts", "menu"]);
      expect(model.tabs[4].action).toBe("menu");
      expect(model.menuMobile).toEqual([]);
    }
  });

  it("personal or brokerage with units gets the rentals section", () => {
    expect(primaryModule({ profile: "personal", units: 1 })).toBe("rentals");
    expect(primaryModule({ profile: "brokerage", units: 3 })).toBe("rentals");
  });

  it("every workspace: at most five top entries, five seats, Assets raised in the centre", () => {
    for (const profile of ["hotel", "car_rental", "personal", "brokerage"]) {
      for (const units of [0, 4]) {
        const model = navModel({ profile, units });
        expect(model.top.length).toBeLessThanOrEqual(5);
        expect(model.tabs).toHaveLength(5);
        expect(model.tabs[2]).toMatchObject({ href: "/assets", center: true });
        expect(model.tabs.filter((seat) => seat.center)).toHaveLength(1);
        // No page reachable twice from the phone's bar.
        expect(new Set(hrefs(model.tabs)).size).toBe(5);
      }
    }
  });
});

describe("tourStops", () => {
  it("has at most six stops and only for sections the workspace has", () => {
    for (const primary of ["rentals", "fleet", null] as const) {
      expect(tourStops(primary).length).toBeLessThanOrEqual(6);
      expect(tourStops(primary)).toContain("alerts");
    }
    expect(tourStops("fleet")).not.toContain("s7");
    expect(tourStops("fleet")).toContain("fleet");
    expect(tourStops(null)).not.toContain("s8");
    expect(tourStops("rentals")).toContain("s7");
  });
});
