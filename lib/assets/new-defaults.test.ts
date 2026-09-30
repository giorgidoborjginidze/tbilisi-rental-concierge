import { describe, expect, it } from "vitest";
import { newAssetDefaults } from "./new-defaults";

describe("newAssetDefaults", () => {
  it("a car rental adds a car that is let", () => {
    expect(newAssetDefaults("car_rental", {})).toEqual({ category: "vehicle", mode: undefined, status: "rented" });
  });

  it("the first-run choices open the right form", () => {
    expect(newAssetDefaults("personal", { category: "real_estate", status: "rented" })).toEqual({
      category: "real_estate",
      mode: undefined,
      status: "rented",
    });
    expect(newAssetDefaults("personal", { category: "real_estate", mode: "daily" })).toEqual({
      category: "real_estate",
      mode: "daily",
      status: "vacant",
    });
    expect(newAssetDefaults("personal", { category: "crypto" }).category).toBe("crypto");
  });

  it("ignores unknown or crafted values", () => {
    expect(newAssetDefaults("personal", { category: "__proto__", mode: "hourly", status: "stolen" })).toEqual({
      category: undefined,
      mode: undefined,
      status: undefined,
    });
    expect(newAssetDefaults("personal", { category: "constructor" }).category).toBeUndefined();
  });

  it("a query category wins over the profile", () => {
    expect(newAssetDefaults("car_rental", { category: "real_estate" })).toEqual({
      category: "real_estate",
      mode: undefined,
      status: undefined,
    });
  });
});
