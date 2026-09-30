import { describe, expect, it } from "vitest";
import {
  clampMessage,
  dailyLimitReason,
  MAX_MESSAGE_CHARS,
  PLATFORM_DAILY_LIMIT,
  RECIPIENT_DAILY_LIMIT,
  withinDailyLimits,
} from "./limits";

const sent = (toPhone: number, toPhoneAllAccounts = toPhone, sameFenceKind?: number) => ({
  toPhone,
  toPhoneAllAccounts,
  sameFenceKind,
});

describe("daily limits per recipient", () => {
  it("lets one account send any number — renter or owner — at most three messages a day", () => {
    expect(withinDailyLimits(sent(RECIPIENT_DAILY_LIMIT - 1))).toBe(true);
    expect(withinDailyLimits(sent(RECIPIENT_DAILY_LIMIT))).toBe(false);
    expect(dailyLimitReason(sent(RECIPIENT_DAILY_LIMIT))).toBe("limit");
  });

  it("counts per sending account, so another account's messages do not use up this owner's three", () => {
    // Someone else sent this driver 3 today; this owner has sent none.
    expect(withinDailyLimits(sent(0, 3))).toBe(true);
    expect(withinDailyLimits(sent(2, 8))).toBe(true);
  });

  it("stops a flood from many accounts at the platform-wide ceiling", () => {
    expect(withinDailyLimits(sent(0, PLATFORM_DAILY_LIMIT - 1))).toBe(true);
    expect(dailyLimitReason(sent(0, PLATFORM_DAILY_LIMIT))).toBe("limit");
  });

  it("announces each kind of red-line event once per fence a day, with its own reason", () => {
    expect(withinDailyLimits(sent(0, 0, 0))).toBe(true);
    expect(dailyLimitReason(sent(0, 0, 1))).toBe("limit_fence");
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
