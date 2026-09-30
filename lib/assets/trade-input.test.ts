import { describe, expect, it } from "vitest";
import { parseTradeInput, TROY_OUNCE_GRAMS } from "./trade-input";

const today = new Date("2026-09-30T00:00:00Z");
const reader = (fields: Record<string, string>) => (key: string) => fields[key] ?? "";

describe("parseTradeInput", () => {
  it("reads a coin buy, dated today when no date is typed", () => {
    expect(parseTradeInput(reader({ quantity: "0.5", unitPrice: "60000" }), { metal: false, today })).toEqual({
      value: { side: "buy", quantity: 0.5, unitPrice: 60000, tradedAt: today },
    });
  });

  it("a 10 g gold bar at 110 $/g is stored in troy ounces at the ounce price (same money)", () => {
    const result = parseTradeInput(
      reader({ quantity: "10", unitPrice: "110", unit: "g", tradedAt: "2026-05-02" }),
      { metal: true, today },
    );
    if ("error" in result || !result.value) throw new Error("expected a trade");
    expect(result.value.quantity).toBeCloseTo(10 / TROY_OUNCE_GRAMS, 10);
    expect(result.value.unitPrice).toBeCloseTo(110 * TROY_OUNCE_GRAMS, 6);
    expect(result.value.quantity * result.value.unitPrice).toBeCloseTo(1100, 6);
    expect(result.value.tradedAt).toEqual(new Date("2026-05-02T00:00:00Z"));
  });

  it("grams only apply to metals", () => {
    const result = parseTradeInput(reader({ quantity: "10", unitPrice: "5", unit: "g" }), { metal: false, today });
    expect(result).toEqual({ value: { side: "buy", quantity: 10, unitPrice: 5, tradedAt: today } });
  });

  it("the first purchase on the add form may be left empty; half-filled is an error", () => {
    expect(parseTradeInput(reader({}), { metal: false, today, optional: true })).toEqual({ value: null });
    expect(parseTradeInput(reader({ quantity: "1" }), { metal: false, today, optional: true })).toEqual({
      error: "error_required",
    });
    expect(parseTradeInput(reader({}), { metal: false, today })).toEqual({ error: "error_required" });
  });

  it("refuses zero or negative quantities, negative prices and bad dates", () => {
    expect(parseTradeInput(reader({ quantity: "0", unitPrice: "1" }), { metal: false, today })).toEqual({
      error: "error_invalid_number",
    });
    expect(parseTradeInput(reader({ quantity: "1", unitPrice: "-1" }), { metal: false, today })).toEqual({
      error: "error_invalid_number",
    });
    expect(
      parseTradeInput(reader({ quantity: "1", unitPrice: "1", tradedAt: "yesterday" }), { metal: false, today }),
    ).toEqual({ error: "error_required" });
  });

  it("a sell is a sell", () => {
    const result = parseTradeInput(reader({ side: "sell", quantity: "1", unitPrice: "1" }), { metal: false, today });
    expect("value" in result && result.value?.side).toBe("sell");
  });
});
