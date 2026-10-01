"use client";

// The currency a holding's price is typed in: dollars (what coins, shares
// and metals are quoted in) or lari — a lari price is converted at the
// National Bank's rate of the trade's date (lib/prices/usd-gel-on.ts).

export type PriceCurrency = "USD" | "GEL";

/** A price label written for USD ("Price per coin (USD)") in the chosen currency. */
export const priceLabelIn = (label: string, currency: PriceCurrency) =>
  currency === "GEL" ? label.replace("USD", "₾") : label;

export default function PriceCurrencySelect({
  value,
  onChange,
  label,
}: {
  value: PriceCurrency;
  onChange: (next: PriceCurrency) => void;
  label: string;
}) {
  return (
    <select
      name="priceCurrency"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value === "GEL" ? "GEL" : "USD")}
      className="price-currency"
    >
      <option value="USD">USD</option>
      <option value="GEL">₾ GEL</option>
    </select>
  );
}
