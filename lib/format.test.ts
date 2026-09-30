import { describe, expect, it } from "vitest";
import { currencySign, formatDueMoney, formatMoney, formatNumber } from "./format";

describe("formatMoney", () => {
  it("puts the lari sign after the number, with separators", () => {
    expect(formatMoney(43082)).toBe("43,082 ₾");
    expect(formatMoney(43082.4, "GEL")).toBe("43,082 ₾");
    expect(formatMoney(320000, "gel")).toBe("320,000 ₾");
  });

  it("uses the sign of other currencies the same way", () => {
    expect(formatMoney(15354, "USD")).toBe("15,354 $");
    expect(formatMoney(90, "EUR")).toBe("90 €");
    expect(formatMoney(12, "CHF")).toBe("12 CHF");
  });

  it("shows a dash for a missing figure", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney(Number.NaN)).toBe("—");
  });

  it("shows tetri only when asked", () => {
    expect(formatMoney(49.4, "GEL", "auto")).toBe("49.40 ₾");
    expect(formatMoney(1200, "GEL", "auto")).toBe("1,200 ₾");
    expect(formatMoney(0.123456, "USD", 4)).toBe("0.1235 $");
  });

  it("quotes debts rounded UP to the tetri", () => {
    expect(formatDueMoney(49.401)).toBe("49.41 ₾");
    expect(formatDueMoney(1826.4, "GEL")).toBe("1,826.40 ₾");
  });
});

describe("helpers", () => {
  it("defaults an unknown or empty currency sensibly", () => {
    expect(currencySign(null)).toBe("₾");
    expect(currencySign(" usd ")).toBe("$");
  });
  it("formats plain numbers", () => {
    expect(formatNumber(1234.5)).toBe("1,235");
    expect(formatNumber(-1200)).toBe("-1,200");
    expect(formatNumber(1.5, 2)).toBe("1.5");
  });
});
