import { describe, expect, it } from "vitest";
import { aggregate } from "./activo";

const obs = (district: string, operatorId: string, value: number) => ({ district, operatorId, value });

describe("Activo's own market figures", () => {
  it("publishes a district only with enough records from enough workspaces", () => {
    const many = [obs("ვაკე", "a", 30), obs("Vake", "b", 32), obs("vake", "c", 28), obs("Vake", "a", 31), obs("Vake", "b", 29)];
    const out = aggregate("rent_sqm", many);
    expect(out).toEqual([{ district: "Vake", metric: "rent_sqm", value: 30, sampleSize: 5 }]);
    // Five contracts of two owners: one owner's rent could be read out of it.
    const twoOwners = many.map((o) => ({ ...o, operatorId: o.operatorId === "c" ? "a" : o.operatorId }));
    expect(aggregate("rent_sqm", twoOwners)).toEqual([]);
    expect(aggregate("rent_sqm", many.slice(0, 4))).toEqual([]);
  });

  it("weights occupancy by nights", () => {
    const out = aggregate("occupancy", [
      { district: "Vera", operatorId: "a", value: 1, weight: 90 },
      { district: "Vera", operatorId: "b", value: 0.5, weight: 90 },
      { district: "Vera", operatorId: "c", value: 0.5, weight: 90 },
      { district: "Vera", operatorId: "d", value: 0, weight: 90 },
      { district: "Vera", operatorId: "e", value: 0.5, weight: 90 },
    ]);
    expect(out[0].value).toBe(0.5);
  });
});
