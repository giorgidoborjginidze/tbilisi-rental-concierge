import { describe, expect, it } from "vitest";
import { afterSplash, showSplash } from "./splash";

describe("showSplash", () => {
  it("only a signed-out visitor who has not seen it this session gets the splash", () => {
    expect(showSplash(false, undefined)).toBe(true);
    expect(showSplash(false, "1")).toBe(false);
    expect(showSplash(true, undefined)).toBe(false);
    expect(showSplash(true, "1")).toBe(false);
  });
});

describe("afterSplash", () => {
  it("does nothing outside a browser", () => {
    let started = false;
    const stop = afterSplash(() => {
      started = true;
    });
    expect(started).toBe(false);
    stop();
  });
});
