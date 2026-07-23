import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { deleteAsset } from "@/lib/assets/actions";
import { fetchUsdGel } from "@/lib/crypto/prices";
import { fetchStockPrices } from "@/lib/stocks/prices";
import { value } from "@/lib/crypto/holdings";
import CryptoTrades from "./crypto-trades";

// Server view for a stock holding: live valuation KPIs + buy/sell entry.
// Shares the holdings math and the buy/sell component with crypto.
export default async function StockView({
  asset,
  locale,
}: {
  asset: { id: string; name: string; symbol: string | null };
  locale: Locale;
}) {
  const trades = await prisma.cryptoTrade.findMany({
    where: { assetId: asset.id },
    orderBy: { tradedAt: "desc" },
  });

  // Live price (USD) + USD→GEL, both best-effort (null-safe).
  const [prices, usdGel] = await Promise.all([
    asset.symbol ? fetchStockPrices([asset.symbol]) : Promise.resolve<Record<string, number>>({}),
    fetchUsdGel(),
  ]);
  const currentPrice = asset.symbol ? prices[asset.symbol.toUpperCase()] ?? null : null;
  const v = value(
    trades.map((tr) => ({ side: tr.side as "buy" | "sell", quantity: tr.quantity, unitPrice: tr.unitPrice })),
    currentPrice,
  );

  const usd = (n: number | null, d = 2) =>
    n == null ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: d })}`;
  const gel = (nUsd: number | null) =>
    nUsd == null ? "—" : `${Math.round(nUsd * usdGel).toLocaleString("en-US")} GEL`;
  const qty = v.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 });

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDate = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);

  const labelKeys: StringKey[] = [
    "crypto_buy", "crypto_sell", "crypto_quantity", "stock_unit_price",
    "crypto_add_trade", "crypto_side", "contract_start", "error_required",
    "error_invalid_number",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));
  // CryptoTrades reads a `crypto_unit_price` label; feed it the stock wording.
  labels.crypto_unit_price = labels.stock_unit_price;

  const profitColor =
    v.profit == null ? undefined : v.profit >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>
          {asset.name}{" "}
          <span className="badge badge--listed" style={{ verticalAlign: "middle" }}>{asset.symbol}</span>
        </h1>
        <Link href="/assets" className="btn-chip">← {t(locale, "assets_title")}</Link>
      </div>

      <section className="kpi-grid" style={{ marginTop: 8 }}>
        <div className="kpi">
          <div className="kpi__label">{t(locale, "stock_holdings")}</div>
          <div className="kpi__value">{qty} {asset.symbol}</div>
          <div className="kpi__sub">{t(locale, "crypto_avg_price")}: {usd(v.avgBuyPrice)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t(locale, "crypto_current_price")}</div>
          <div className="kpi__value">{usd(currentPrice)}</div>
          <div className="kpi__sub">
            {currentPrice == null ? t(locale, "crypto_price_na") : t(locale, "crypto_live")}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t(locale, "crypto_value")}</div>
          <div className="kpi__value">{usd(v.currentValue, 0)}</div>
          <div className="kpi__sub">≈ {gel(v.currentValue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t(locale, "crypto_pnl")}</div>
          <div className="kpi__value" style={{ color: profitColor }}>
            {v.profit == null ? "—" : `${v.profit >= 0 ? "+" : ""}${usd(v.profit, 0)}`}
          </div>
          <div className="kpi__sub" style={{ color: profitColor }}>
            {v.profitPct == null ? "" : `${v.profitPct >= 0 ? "+" : ""}${(v.profitPct * 100).toFixed(1)}%`}
          </div>
        </div>
      </section>

      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        {t(locale, "stock_hint")}
      </p>

      <section>
        <h2>{t(locale, "crypto_trades")}</h2>
        <CryptoTrades
          assetId={asset.id}
          symbol={asset.symbol ?? ""}
          today={today}
          labels={labels}
          trades={trades.map((tr) => ({
            id: tr.id,
            side: tr.side as "buy" | "sell",
            quantity: tr.quantity,
            unitPrice: tr.unitPrice,
            date: fmtDate.format(tr.tradedAt),
          }))}
        />
      </section>

      <form action={deleteAsset} className="mt-6">
        <input type="hidden" name="assetId" value={asset.id} />
        <button type="submit" className="btn-danger">{t(locale, "delete")}</button>
      </form>
    </main>
  );
}
