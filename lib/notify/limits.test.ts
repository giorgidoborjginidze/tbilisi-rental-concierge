import { describe, expect, it } from "vitest";
import {
  clampMessage,
  MAX_MESSAGE_CHARS,
  OWNER_DAILY_LIMIT,
  RENTER_DAILY_LIMIT,
  withinDailyLimits,
} from "./limits";

describe("daily limits per recipient", () => {
  it("lets a renter's number receive at most three messages a day", () => {
    const sent = (n: number) => ({ toPhone: n, toPhoneForAsset: n });
    expect(withinDailyLimits("driver", sent(RENTER_DAILY_LIMIT - 1))).toBe(true);
    expect(withinDailyLimits("driver", sent(RENTER_DAILY_LIMIT))).toBe(false);
    expect(withinDailyLimits("tenant", sent(RENTER_DAILY_LIMIT))).toBe(false);
  });

  it("counts the owner's own number per asset, with an overall ceiling", () => {
    // A fleet owner already told about five other cars still hears about this one.
    expect(withinDailyLimits("owner", { toPhone: 5, toPhoneForAsset: 0 })).toBe(true);
    expect(withinDailyLimits("owner", { toPhone: 5, toPhoneForAsset: 3 })).toBe(false);
    expect(withinDailyLimits("owner", { toPhone: OWNER_DAILY_LIMIT, toPhoneForAsset: 0 })).toBe(false);
  });

  it("announces each kind of red-line event once per fence a day", () => {
    expect(withinDailyLimits("driver", { toPhone: 0, toPhoneForAsset: 0, sameFenceKind: 0 })).toBe(true);
    expect(withinDailyLimits("driver", { toPhone: 0, toPhoneForAsset: 0, sameFenceKind: 1 })).toBe(false);
    expect(withinDailyLimits("owner", { toPhone: 0, toPhoneForAsset: 0, sameFenceKind: 1 })).toBe(false);
  });
});

describe("message text", () => {
  it("is kept on one line without long runs of spaces", () => {
    expect(clampMessage("Hello\n\nthere\t  you      go ")).toBe("Hello there you go");
  });

  it("is cut at a word, with an ellipsis, when it is too long", () => {
    const long = "ქირა ".repeat(200);
    const out = clampMessage(long);
    expect([...out].length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(out.endsWith("ქირა…")).toBe(true);
    expect(clampMessage("short text")).toBe("short text");
  });
});
