import { describe, expect, it } from "vitest";
import { rentLabel } from "./display";

describe("rentLabel", () => {
  it("shows the amount per period with the lari sign after it", () => {
    const base = { currency: "GEL", monthlyRent: 1826, paymentAmount: 60, paymentPeriod: "daily" };
    expect(rentLabel("ka", base)).toBe("60 ₾ / დღე");
    expect(rentLabel("en", { ...base, paymentAmount: 1200, paymentPeriod: "monthly", monthlyRent: 1200 })).toMatch(
      /^1,200 ₾ \/ /,
    );
    expect(rentLabel("en", { ...base, currency: "USD", paymentAmount: 99.5 })).toMatch(/^99\.5 \$ \//);
  });
});
