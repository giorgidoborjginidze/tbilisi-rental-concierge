// Numbers as they read on screen and in messages: thousands separators,
// no currency ("1,200", "49.40"). The one number formatter — lib/format.ts
// adds the currency sign on top of it, lib/rentals/money.ts the rounding of
// an amount owed. A leaf module (no imports), pure and client-safe.

export type Decimals = "auto" | number;

/** "1,200" / "49.40" (auto: tetri only when there are any) / "1,200.5" (up to n). */
export function formatNumber(value: number, decimals: Decimals = 0): string {
  if (decimals === "auto") {
    const whole = Math.abs(value - Math.round(value)) < 0.005;
    return whole
      ? Math.round(value).toLocaleString("en-US")
      : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (decimals <= 0) return Math.round(value).toLocaleString("en-US");
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** How many units of a holding: a coin or share to 8 places, a metal (troy oz) to 4. */
export function formatQuantity(value: number, kind: string): string {
  return formatNumber(value, kind === "metal" ? 4 : 8);
}

/** A change as a signed percentage of one decimal: 0.123 → "+12.3%", -0.05 → "-5.0%". */
export function formatSignedPercent(fraction: number): string {
  return `${fraction >= 0 ? "+" : ""}${(fraction * 100).toFixed(1)}%`;
}
