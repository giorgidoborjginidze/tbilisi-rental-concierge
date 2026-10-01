import { describe, expect, it } from "vitest";
import { alertDeskTab, deskHref, deskTab, fleetRank, rentalDesk } from "./desk";

describe("rentalDesk", () => {
  it("vehicles get the full desk, real estate the property desk", () => {
    expect(rentalDesk("vehicle")).toBe("vehicle");
    expect(rentalDesk("real_estate")).toBe("property");
  });

  it("holdings and income streams get no desk at all", () => {
    for (const category of ["crypto", "stock", "metal", "income_source"]) {
      expect(rentalDesk(category)).toBeNull();
      expect(rentalDesk(category, 3)).toBeNull();
    }
  });

  it("equipment gets the property desk only once it has a contract", () => {
    expect(rentalDesk("other")).toBeNull();
    expect(rentalDesk("other", 1)).toBe("property");
  });
});

describe("deskTab", () => {
  it("a rented car (or one that still owes) opens on payments", () => {
    expect(deskTab(undefined, true)).toBe("payments");
  });
  it("a car that is not out opens on the overview", () => {
    expect(deskTab(null, false)).toBe("overview");
  });
  it("an explicit tab wins; an unknown one falls back", () => {
    expect(deskTab("gps", true)).toBe("gps");
    expect(deskTab("messages", false)).toBe("messages");
    expect(deskTab("nonsense", false)).toBe("overview");
  });
});

describe("alertDeskTab / deskHref", () => {
  it("sends red-line and tracker alerts to GPS, rent alerts to payments", () => {
    expect(alertDeskTab("geofence_breach")).toBe("gps");
    expect(alertDeskTab("tracker_silent")).toBe("gps");
    expect(alertDeskTab("rent_overdue")).toBe("payments");
    expect(alertDeskTab("repossession_right")).toBe("payments");
    expect(alertDeskTab("contract_expiry")).toBe("overview");
  });
  it("adds the tab only for the vehicle desk", () => {
    expect(deskHref("a1", "vehicle", "gps")).toBe("/assets/a1/rental?tab=gps");
    expect(deskHref("a1", "property", "payments")).toBe("/assets/a1/rental");
    expect(deskHref("a1", "vehicle")).toBe("/assets/a1/rental");
  });
});

describe("fleetRank", () => {
  const car = { payState: null, endedOwing: false, outside: false, silent: false, rented: false };
  it("puts a repossession or a car outside its red line first, a free car last", () => {
    const ranks = [
      fleetRank({ ...car }),
      fleetRank({ ...car, rented: true, payState: "ok" }),
      fleetRank({ ...car, rented: true, payState: "due" }),
      fleetRank({ ...car, rented: true, payState: "grace" }),
      fleetRank({ ...car, rented: true, payState: "repossess" }),
    ];
    expect(ranks).toEqual([4, 3, 2, 1, 0]);
    expect(fleetRank({ ...car, rented: true, outside: true })).toBe(0);
    expect(fleetRank({ ...car, endedOwing: true })).toBe(1);
    expect(fleetRank({ ...car, rented: true, silent: true })).toBe(2);
  });
});

describe("rentalDesk for personal use", () => {
  it("a car kept for personal use with no contract gets no desk; with a contract it keeps one", () => {
    expect(rentalDesk("vehicle", 0, "personal_use")).toBeNull();
    expect(rentalDesk("real_estate", 0, "personal_use")).toBeNull();
    expect(rentalDesk("vehicle", 1, "personal_use")).toBe("vehicle");
    expect(rentalDesk("vehicle", 0, "rented")).toBe("vehicle");
  });
});
