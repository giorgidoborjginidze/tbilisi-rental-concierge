import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { IconArrowLeft, IconTrash } from "@/app/icons";
import { prisma } from "@/lib/db";
import { tbilisiFormat, todayKey } from "@/lib/time";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { deleteAsset } from "@/lib/assets/actions";
import { fetchUsdGel, fetchUsdPrices } from "@/lib/crypto/prices";
import { fetchStockPrices } from "@/lib/stocks/prices";
import { fetchMetalPrices } from "@/lib/metals/prices";
import { value } from "@/lib/crypto/holdings";
import { TROY_OUNCE_GRAMS } from "@/lib/assets/trade-input";
import ConfirmAction from "@/app/confirm-action";
import CryptoTrades from "./crypto-trades";

type HoldingKind = "crypto" | "stock" | "metal";

// One view for every holding — a coin, a share, a precious metal: the live
// valuation, then the buys and sells. A holding with no purchase yet opens
// on the purchase form instead of a row of zeros. Deleting the holding (and
// every trade of it) sits apart, at the bottom, and asks first.
export default async function HoldingView({
  kind,
  asset,
  locale,
  justAdded = false,
}: {
  kind: HoldingKind;
  asset: { id: string; name: string; symbol: string | null; coingeckoId: string | null };
  locale: Locale;
  justAdded?: boolean;
}) {
  const trades = await prisma.cryptoTrade.findMany({
    where: { assetId: asset.id },
    orderBy: { tradedAt: "desc" },
  });

  // Live price (USD) + USD→GEL, both best-effort (null-safe).
  const symbol = asset.symbol?.toUpperCase() ?? "";
  const [prices, usdGel] = await Promise.all([
    kind === "crypto"
      ? asset.coingeckoId
        ? fetchUsdPrices([asset.coingeckoId])
        : Promise.resolve<Record<string, number>>({})
      : symbol
        ? kind === "stock"
          ? fetchStockPrices([symbol])
          : fetchMetalPrices([symbol])
        : Promise.resolve<Record<string, number>>({}),
    fetchUsdGel(),
  ]);
  const currentPrice =
    (kind === "crypto" ? (asset.coingeckoId ? prices[asset.coingeckoId] : undefined) : prices[symbol]) ?? null;
  const v = value(
    trades.map((tr) => ({ side: tr.side as "buy" | "sell", quantity: tr.quantity, unitPrice: tr.unitPrice })),
    currentPrice,
  );

  const usd = (n: number | null, d = 2) => formatMoney(n, "USD", d);
  const gel = (nUsd: number | null) => (nUsd == null ? "—" : formatMoney(nUsd * usdGel));
  const qty = v.quantity.toLocaleString("en-US", { maximumFractionDigits: kind === "metal" ? 4 : 8 });

  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  const labelKeys: StringKey[] = [
    "aria_delete_trade", "crypto_buy", "crypto_sell", "crypto_quantity", "crypto_unit_price",
    "crypto_add_trade", "crypto_side", "error_required", "error_invalid_number", "error_demo_readonly",
    "trade_date_buy", "trade_date_sell", "trade_date", "trade_saved", "trade_delete_q",
    "delete", "cancel", "metal_unit_oz", "metal_unit_g", "metal_unit_label", "form_required_legend",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));
  // The trade form and table read crypto_quantity / crypto_unit_price.
  if (kind === "stock") labels.crypto_unit_price = t(locale, "stock_unit_price");
  if (kind === "metal") {
    labels.crypto_quantity = t(locale, "metal_quantity");
    labels.crypto_unit_price = t(locale, "metal_unit_price_generic");
  }

  const profitColor =
    v.profit == null ? undefined : v.profit >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";
  const holdingLabel: StringKey =
    kind === "crypto" ? "crypto_holdings" : kind === "stock" ? "stock_holdings" : "metal_holdings";
  const hint: StringKey = kind === "crypto" ? "crypto_hint" : kind === "stock" ? "stock_hint" : "metal_footnote";
  const tag = symbol || asset.name;

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>
          {asset.name}{" "}
          {asset.symbol && (
            <span className="badge badge--tag" style={{ verticalAlign: "middle" }}>{asset.symbol}</span>
          )}
        </h1>
        <Link href="/assets" className="btn-chip btn-chip--icon-text">
          <IconArrowLeft size={14} /> {t(locale, "assets_title")}
        </Link>
      </div>

      {justAdded && (
        <p className="alert-card alert-card--good" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "asset_added_note").replace("{name}", asset.name)}
        </p>
      )}

      {trades.length === 0 ? (
        <p className="alert-card alert-card--info" style={{ display: "block", fontSize: 13.5 }}>
          {t(locale, "holding_empty").replace("{symbol}", tag)}
        </p>
      ) : (
        <section className="kpi-grid" style={{ marginTop: 8 }}>
          <div className="kpi">
            <div className="kpi__label">{t(locale, holdingLabel)}</div>
            <div className="kpi__value">
              {qty} {kind === "metal" ? t(locale, "metal_unit_oz") : asset.symbol}
            </div>
            <div className="kpi__sub">
              {kind === "metal"
                ? `≈ ${(v.quantity * TROY_OUNCE_GRAMS).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${t(locale, "metal_unit_g")} · `
                : ""}
              {t(locale, "crypto_avg_price")}: {usd(v.avgBuyPrice)}
            </div>
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
      )}

      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{t(locale, hint)}</p>

      <section>
        <h2>{t(locale, "crypto_trades")}</h2>
        <CryptoTrades
          assetId={asset.id}
          symbol={tag}
          metal={kind === "metal"}
          today={todayKey()}
          labels={labels}
          initialOpen={trades.length === 0 ? "buy" : null}
          trades={trades.map((tr) => ({
            id: tr.id,
            side: tr.side as "buy" | "sell",
            quantity: tr.quantity,
            unitPrice: tr.unitPrice,
            date: fmtDate.format(tr.tradedAt),
          }))}
        />
      </section>

      {/* Deleting the holding takes every trade with it: apart, at the
          bottom, named, and asked first. */}
      <div className="danger-zone">
        <ConfirmAction
          action={deleteAsset}
          fields={{ assetId: asset.id }}
          trigger={
            <>
              <IconTrash size={15} /> {t(locale, "holding_delete").replace("{symbol}", tag)}
            </>
          }
          triggerClassName="btn-danger btn-compact icon-text"
          question={t(locale, "holding_delete_q")
            .replace("{symbol}", tag)
            .replace("{n}", String(trades.length))}
          confirmLabel={t(locale, "delete")}
          cancelLabel={t(locale, "cancel")}
        />
        <p className="danger-zone__hint">{t(locale, "holding_delete_hint")}</p>
      </div>
    </main>
  );
}
