import { describe, expect, it } from "vitest";
import { firstParam } from "./params";

describe("firstParam", () => {
  it("takes the first of a repeated parameter", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("a")).toBe("a");
  });
  it("treats empty and missing alike", () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam("")).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});
