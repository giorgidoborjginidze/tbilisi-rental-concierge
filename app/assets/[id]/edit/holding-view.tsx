import Link from "next/link";
import { formatMoney, formatNumber, formatQuantity, formatSignedPercent } from "@/lib/format";
import { IconArrowLeft, IconTrash } from "@/app/icons";
import { prisma } from "@/lib/db";
import { tbilisiFormat, todayKey } from "@/lib/time";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { deleteAsset } from "@/lib/assets/actions";
import { loadQuotes } from "@/lib/prices/quotes";
import { quoteKey } from "@/lib/prices/freshness";
import { priceAge, rateLine } from "@/lib/prices/labels";
import { value } from "@/lib/crypto/holdings";
import Approx from "@/app/approx";
import { TROY_OUNCE_GRAMS } from "@/lib/assets/trade-input";
import ConfirmAction from "@/app/confirm-action";
import CryptoTrades from "./crypto-trades";
import Kpi, { KpiSub } from "../../../kpi";

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
  deleteBlocked = false,
}: {
  kind: HoldingKind;
  asset: { id: string; name: string; symbol: string | null; coingeckoId: string | null };
  locale: Locale;
  justAdded?: boolean;
  /** A buy was not deleted because a later sell depends on it. */
  deleteBlocked?: boolean;
}) {
  const trades = await prisma.cryptoTrade.findMany({
    where: { assetId: asset.id },
    orderBy: { tradedAt: "desc" },
  });

  // The price (USD): live, else the last known one with its age — the
  // same stored quotes as /assets and the dashboard (lib/prices/quotes.ts).
  const symbol = asset.symbol?.toUpperCase() ?? "";
  const priceId = kind === "crypto" ? asset.coingeckoId ?? "" : symbol;
  const { quotes, rate } = await loadQuotes(priceId ? [{ kind, id: priceId }] : []);
  const quote = priceId ? quotes.get(quoteKey(kind, priceId)) ?? null : null;
  const currentPrice = quote?.price ?? null;
  const usdGel = rate.value;
  const now = new Date();
  const v = value(
    trades.map((tr) => ({
      side: tr.side === "sell" ? ("sell" as const) : ("buy" as const),
      quantity: tr.quantity,
      unitPrice: tr.unitPrice,
      tradedAt: tr.tradedAt,
      createdAt: tr.createdAt,
    })),
    currentPrice,
  );
  const approxLabel = t(locale, "approx_word");
  const approx = v.quantity > 0 && (!quote || !quote.fresh || rate.state !== "live");

  const usd = (n: number | null, d = 2) => formatMoney(n, "USD", d);
  const gel = (nUsd: number | null) => (nUsd == null ? "—" : formatMoney(nUsd * usdGel));
  // Without any price the holding counts at what was paid for it.
  const shownValue = v.currentValue ?? v.costBasis;
  const qty = formatQuantity(v.quantity, kind);

  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });

  const labelKeys: StringKey[] = [
    "aria_delete_trade", "crypto_buy", "crypto_sell", "crypto_quantity", "crypto_unit_price",
    "price_currency", "price_gel_hint", "error_rate_unavailable", "decide_undo", "deleted_undo_trade", "col_actions",
    "crypto_add_trade", "crypto_side", "error_required", "error_invalid_number", "error_demo_readonly",
    "trade_date_buy", "trade_date_sell", "trade_date", "trade_saved", "trade_delete_q",
    "delete", "cancel", "metal_unit_oz", "metal_unit_g", "metal_unit_label", "form_required_legend",
    "error_sell_exceeds", "error_sell_uncovers_later",
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

      {v.oversold > 0 && (
        <p className="alert-card alert-card--warn" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "holding_oversold").replace(
            "{n}",
            formatQuantity(v.oversold, kind),
          )}
        </p>
      )}

      {trades.length === 0 ? (
        <p className="alert-card alert-card--info" style={{ display: "block", fontSize: 13.5 }}>
          {t(locale, "holding_empty").replace("{symbol}", tag)}
        </p>
      ) : (
        <section className="kpi-grid" style={{ marginTop: 8 }}>
          <Kpi
            label={t(locale, holdingLabel)}
            value={`${qty} ${kind === "metal" ? t(locale, "metal_unit_oz") : asset.symbol}`}
            sub={
              <>
                {kind === "metal"
                  ? `${formatNumber(v.quantity * TROY_OUNCE_GRAMS, 1)} ${t(locale, "metal_unit_g")} · `
                  : ""}
                {t(locale, "crypto_avg_price")}: {usd(v.avgBuyPrice)}
              </>
            }
          />
          <Kpi
            label={t(locale, "crypto_current_price")}
            value={usd(currentPrice)}
            sub={
              !quote
                ? t(locale, "crypto_price_na")
                : quote.fresh
                  ? t(locale, "crypto_live")
                  : t(locale, "price_last_known").replace("{age}", priceAge(locale, quote.fetchedAt, now))
            }
          />
          <Kpi
            label={t(locale, "crypto_value")}
            value={
              <>
                {approx && <Approx label={approxLabel} />}
                {usd(shownValue, 0)}
              </>
            }
            sub={`${gel(shownValue)}${!quote && v.quantity > 0 ? ` · ${t(locale, "price_at_cost")}` : ""}`}
          />
          <Kpi
            label={t(locale, "crypto_pnl")}
            value={v.profit == null ? "—" : `${v.profit >= 0 ? "+" : ""}${usd(v.profit, 0)}`}
            valueStyle={{ color: profitColor }}
            sub={v.profitPct == null ? undefined : formatSignedPercent(v.profitPct)}
            subStyle={{ color: profitColor }}
          >
            {Math.abs(v.realizedProfit) >= 0.005 && (
              <KpiSub>
                {t(locale, "holding_realized")}: {v.realizedProfit >= 0 ? "+" : ""}
                {usd(v.realizedProfit, 0)}
              </KpiSub>
            )}
          </Kpi>
        </section>
      )}

      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        {t(locale, hint)} {v.quantity > 0 && rateLine(locale, rate, now)}
      </p>

      <section id="trades" style={{ scrollMarginTop: 80 }}>
        <h2>{t(locale, "crypto_trades")}</h2>
        {/* Next to the trades it is about (the page lands here). */}
        {deleteBlocked && (
          <p className="alert-card alert-card--warn" role="alert" style={{ display: "block", fontSize: 13 }}>
            {t(locale, "trade_delete_blocked")}
          </p>
        )}
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
