import { describe, expect, it } from "vitest";
import { alertHref } from "./links";

const desk = (assetId: string) => (assetId.startsWith("car") ? "vehicle" : assetId.startsWith("flat") ? "property" : null);

describe("alertHref", () => {
  it("a unit's free window opens its calendar on that month", () => {
    expect(alertHref({ type: "vacancy_gap", unitId: "u1", payload: { start: "2026-10-27" } }, desk)).toBe(
      "/calendar?unit=u1&month=2026-10",
    );
    expect(alertHref({ type: "lease_expiry", unitId: "u1", payload: { endDate: "2026-11-02" } }, desk)).toBe(
      "/calendar?unit=u1&month=2026-11",
    );
  });

  it("an underpriced unit opens the night price table on its row", () => {
    expect(alertHref({ type: "underpriced", unitId: "u1", payload: { month: "2026-10" } }, desk)).toBe(
      "/pricing?unit=u1",
    );
  });

  it("a car's alert opens the desk tab it is about", () => {
    expect(alertHref({ type: "geofence_breach", unitId: null, payload: { assetId: "car1" } }, desk)).toBe(
      "/assets/car1/rental?tab=gps",
    );
    expect(alertHref({ type: "repossession_right", unitId: null, payload: { assetId: "car1" } }, desk)).toBe(
      "/assets/car1/rental?tab=payments",
    );
    expect(alertHref({ type: "contract_expiry", unitId: null, payload: { assetId: "flat1" } }, desk)).toBe(
      "/assets/flat1/rental",
    );
  });

  it("two contracts over the same days open the asset's contracts; no desk → the asset page", () => {
    expect(alertHref({ type: "overlap", unitId: null, payload: { assetId: "car1" } }, desk)).toBe(
      "/assets/car1/edit#contracts",
    );
    expect(alertHref({ type: "contract_ended", unitId: null, payload: { assetId: "gold" } }, desk)).toBe(
      "/assets/gold/edit",
    );
    expect(alertHref({ type: "contract_ended", unitId: null, payload: {} }, desk)).toBe("/alerts");
  });
});
