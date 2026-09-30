import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey, type Locale } from "@/lib/i18n/strings";
import { monthlyIncome } from "@/lib/analytics/monthly-income";
import { incomeParts } from "@/lib/analytics/income-display";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { fetchUsdGel, fetchUsdPrices, FALLBACK_USD_GEL } from "@/lib/crypto/prices";
import { fetchStockPrices } from "@/lib/stocks/prices";
import { fetchMetalPrices } from "@/lib/metals/prices";
import { value as cryptoValue } from "@/lib/crypto/holdings";
import { LISTING_PLATFORMS } from "@/lib/types";
import ListingControls, { type ListingLink } from "./listing-controls";
import DoorKey from "./door-key";
import AssetSegments from "./asset-segments";
import AssetFlipCard, { type FlipAsset } from "./asset-flip-card";
import { lateContract, statusFor } from "@/lib/rentals/terms";
import { activeContract as runningContract, assetStatusNow } from "@/lib/rentals/phase";
import { rentLabel } from "@/lib/rentals/display";
import { monthKeyTbilisi, monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  rented: "badge--rented",
  str: "badge--str",
  vacant: "badge--vacant",
  personal_use: "badge--personal",
  listed: "badge--listed",
};

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  );
}

interface HoldingRow {
  asset: { id: string; name: string; symbol: string | null };
  price: number | null;
  v: {
    quantity: number;
    avgBuyPrice: number | null;
    currentValue: number | null;
    profit: number | null;
    profitPct: number | null;
  };
}

// One holding sub-table (crypto / stock / metal) inside Digital Assets.
function HoldingTable({
  locale, money, heading, subUsd, subGel, holdingsLabel, qtyDigits, rows,
}: {
  locale: Locale;
  money: (v: number) => string;
  heading: string;
  subUsd: number;
  subGel: number;
  holdingsLabel: string;
  qtyDigits: number;
  rows: HoldingRow[];
}) {
  if (rows.length === 0) return null;
  const d = (n: number | null, dp = 2) =>
    n == null ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: dp })}`;
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 0 }}>
        {heading}
        {subUsd > 0 && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: 13 }}>
            {" "}· ${Math.round(subUsd).toLocaleString("en-US")} ≈ {money(subGel)}
          </span>
        )}
      </h3>
      <div className="card card--stack" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>{t(locale, "holding_name")}</th>
              <th className="num">{holdingsLabel}</th>
              <th className="num">{t(locale, "crypto_avg_price")}</th>
              <th className="num">{t(locale, "crypto_current_price")}</th>
              <th className="num">{t(locale, "crypto_value")}</th>
              <th className="num">{t(locale, "crypto_pnl")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ asset, price, v }) => {
              const pc = v.profit == null ? undefined : v.profit >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";
              return (
                <tr key={asset.id}>
                  <td>
                    <Link href={`/assets/${asset.id}/edit`} className="link">{asset.name}</Link>
                    <div className="cell-sub">{asset.symbol}</div>
                  </td>
                  <td className="num" data-label={holdingsLabel}>
                    {v.quantity.toLocaleString("en-US", { maximumFractionDigits: qtyDigits })}
                  </td>
                  <td className="num" data-label={t(locale, "crypto_avg_price")}>{d(v.avgBuyPrice)}</td>
                  <td className="num" data-label={t(locale, "crypto_current_price")}>{d(price)}</td>
                  <td className="num" data-label={t(locale, "crypto_value")}>{d(v.currentValue, 0)}</td>
                  <td className="num" data-label={t(locale, "crypto_pnl")} style={{ color: pc, fontWeight: 600 }}>
                    {v.profit == null ? "—" : `${v.profit >= 0 ? "+" : ""}${d(v.profit, 0)}`}
                    {v.profitPct != null && (
                      <div className="cell-sub" style={{ color: pc }}>
                        {v.profitPct >= 0 ? "+" : ""}{(v.profitPct * 100).toFixed(1)}%
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <Link href={`/assets/${asset.id}/edit`} className="link">{t(locale, "edit")}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AssetsPage() {
  const operator = await requireOperator();

  const locale = await getLocale();
  const today = startOfTodayTbilisi();
  const monthKey = monthKeyTbilisi();

  const [assets, income] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id },
      include: {
        contracts: { orderBy: { endDate: "desc" } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    // The one income definition — the same total as the dashboard.
    monthlyIncome(operator.id, monthStartTbilisi(0)),
  ]);

  const activeContract = (asset: (typeof assets)[number]) =>
    runningContract(asset.contracts, today);

  // The asset follows its contracts: "Rented" only while one runs, so a
  // lease that ended in August no longer shows "Rented · Contract —".
  const effectiveStatus = (asset: (typeof assets)[number]) =>
    activeContract(asset)
      ? "rented"
      : asset.unitId
        ? "str"
        : assetStatusNow(asset, asset.contracts, today);

  // Listing links per asset: platform set follows the category; assets in
  // personal use get no links at all (nothing is published for them).
  const listingLinks = (asset: (typeof assets)[number]): ListingLink[] => {
    if (effectiveStatus(asset) === "personal_use") return [];
    const record = asset as unknown as Record<string, string | null>;
    return (LISTING_PLATFORMS[asset.category] ?? [])
      .filter((platform) => record[platform.field])
      .map((platform) => ({
        platform: platform.key,
        label: platform.label,
        url: record[platform.field]!,
      }));
  };

  // ── Crypto, stock & metal holdings: live valuation in USD → GEL. ──
  const [cryptoAssets, stockAssets, metalAssets] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: "crypto" },
      include: { trades: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: "stock" },
      include: { trades: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { operatorId: operator.id, category: "metal" },
      include: { trades: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const needRate = cryptoAssets.length > 0 || stockAssets.length > 0 || metalAssets.length > 0;
  const [cryptoPrices, stockPrices, metalPrices, usdGel] = await Promise.all([
    cryptoAssets.length
      ? fetchUsdPrices(cryptoAssets.map((c) => c.coingeckoId).filter(Boolean) as string[])
      : Promise.resolve<Record<string, number>>({}),
    stockAssets.length
      ? fetchStockPrices(stockAssets.map((s) => s.symbol).filter(Boolean) as string[])
      : Promise.resolve<Record<string, number>>({}),
    metalAssets.length
      ? fetchMetalPrices(metalAssets.map((m) => m.symbol).filter(Boolean) as string[])
      : Promise.resolve<Record<string, number>>({}),
    needRate ? fetchUsdGel() : Promise.resolve(FALLBACK_USD_GEL),
  ]);

  const holdingRows = (
    list: typeof cryptoAssets,
    priceOf: (a: (typeof cryptoAssets)[number]) => number | null,
  ) =>
    list.map((a) => {
      const price = priceOf(a);
      const v = cryptoValue(
        a.trades.map((tr) => ({ side: tr.side as "buy" | "sell", quantity: tr.quantity, unitPrice: tr.unitPrice })),
        price,
      );
      return { asset: a, price, v };
    });

  const cryptoRows = holdingRows(cryptoAssets, (c) =>
    c.coingeckoId ? cryptoPrices[c.coingeckoId] ?? null : null,
  );
  const stockRows = holdingRows(stockAssets, (s) =>
    s.symbol ? stockPrices[s.symbol.toUpperCase()] ?? null : null,
  );
  const metalRows = holdingRows(metalAssets, (m) =>
    m.symbol ? metalPrices[m.symbol.toUpperCase()] ?? null : null,
  );

  const sumUsd = (rows: { v: { currentValue: number | null } }[]) =>
    rows.reduce((s, r) => s + (r.v.currentValue ?? 0), 0);
  const cryptoValueUsd = sumUsd(cryptoRows);
  const stockValueUsd = sumUsd(stockRows);
  const metalValueUsd = sumUsd(metalRows);
  const cryptoValueGel = cryptoValueUsd * usdGel;
  const stockValueGel = stockValueUsd * usdGel;
  const metalValueGel = metalValueUsd * usdGel;

  // Digital assets = crypto + stocks + metals, shown together in one segment.
  const digitalValueUsd = cryptoValueUsd + stockValueUsd + metalValueUsd;
  const digitalValueGel = cryptoValueGel + stockValueGel + metalValueGel;

  const totalValue =
    assets.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0) +
    digitalValueGel;

  // Market-rent benchmarks per district (current month).
  const districts = [...new Set(assets.map((a) => a.district).filter(Boolean))] as string[];
  const rentBenchmarks = new Map(
    await Promise.all(
      districts.map(async (district) => {
        const benchmark = await getRentBenchmark(district, monthKey);
        return [district, benchmark] as const;
      }),
    ),
  );

  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const money = (v: number) => `${Math.round(v).toLocaleString("en-US")} GEL`;
  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;

  // Late rent, straight from the same schedule the alerts and the WhatsApp
  // reminders use — so the list agrees with everything else.
  const overdueBadge = (
    contract: {
      startDate: Date;
      endDate: Date;
      paymentPeriod: string;
      paymentAmount: number | null;
      monthlyRent: number;
      graceDays: number;
      paidThrough: Date | null;
      creditBalance: number;
    } | null | undefined,
    pricing: { dailyRate: number | null; weekendPct: number | null; holidayPct: number | null },
  ) => {
    if (!contract?.paidThrough) return null;
    const status = statusFor(contract, today, pricing);
    if (status.state !== "grace" && status.state !== "repossess") return null;
    return {
      label: `${t(locale, "pay_days_overdue")}: ${status.daysOverdue}`,
      severe: status.state === "repossess",
    };
  };

  const flipLabels = Object.fromEntries(
    (
      [
        "edit", "contracts_col", "contract_until",
        "market_rent_est", "below_market", "asset_value_col", "mode_daily",
        "rental_service",
      ] as StringKey[]
    ).map((k) => [k, t(locale, k)]),
  );

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "assets_title")}</h1>
        <Link href="/assets/new" className="btn-primary" data-tour="new-asset">
          {t(locale, "assets_add")}
        </Link>
      </div>

      <section className="kpi-grid kpi-grid--3d kpi-grid--2">
        <Kpi label={t(locale, "assets_total_value")} value={money(totalValue)} />
        <Kpi
          label={t(locale, "income_all_month")}
          value={money(income.total)}
          sub={incomeParts(locale, income, money) || t(locale, "income_all_hint")}
        />
      </section>

      {assets.length === 0 && (
        <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "assets_empty")}</p>
      )}
      {assets.length > 0 && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, "asset_detail_hint")}
        </p>
      )}

      <AssetSegments
        options={[
          { value: "all", label: t(locale, "seg_all") },
          { value: "real_estate", label: t(locale, "seg_real_estate") },
          { value: "vehicle", label: t(locale, "seg_vehicle") },
          { value: "income", label: t(locale, "seg_income") },
          { value: "digital", label: t(locale, "seg_digital") },
        ]}
        segments={[
          ...(
            [
              { key: "real_estate", title: "section_real_estate" },
              { key: "vehicle", title: "section_vehicles" },
              { key: "other", title: "section_general" },
            ] as const
          ).map(({ key, title }) => {
            const group = assets.filter((a) => a.category === key);
            return { group: key, empty: group.length === 0, addHref: `/assets/new?category=${key}`, node: group.length === 0 ? null : (
          <section key={key}>
            <h2>{t(locale, title)}</h2>
            <div className="aflip-grid">
              {group.map((asset) => {
                const contract = activeContract(asset);
                const status = effectiveStatus(asset);
                const benchmark = asset.district
                  ? rentBenchmarks.get(asset.district) ?? null
                  : null;
                const marketRent =
                  asset.category === "real_estate"
                    ? estimateMarketRent(asset.areaSqm, benchmark)
                    : null;
                const flip: FlipAsset = {
                  id: asset.id,
                  name: displayName(asset),
                  district: asset.district,
                  address: asset.address,
                  typeLabel: t(locale, `type_${asset.type}` as StringKey),
                  statusLabel: t(locale, `status_${status}` as StringKey),
                  statusClass: STATUS_BADGE[status] ?? STATUS_BADGE.personal_use,
                  contract: contract
                    ? `${rentLabel(locale, contract)} · ${contract.tenantName ?? "—"}`
                    : null,
                  contractUntil: contract ? fmtDate.format(contract.endDate) : null,
                  marketRent: marketRent ? `~${marketRent} GEL` : null,
                  belowMarket: Boolean(
                    contract && marketRent && contract.monthlyRent < marketRent * 0.85,
                  ),
                  value: asset.estimatedValue ? money(asset.estimatedValue) : null,
                  daily: asset.rentalMode === "daily",
                  // The running contract when late, else a finished one
                  // that still has rent owed.
                  overdue: overdueBadge(lateContract(asset.contracts, today, asset), asset),
                  serviceHref: `/assets/${asset.id}/rental`,
                  category: asset.category,
                };
                return (
                  <AssetFlipCard
                    key={asset.id}
                    asset={flip}
                    labels={flipLabels}
                    extras={
                      <>
                        {status !== "str" && (
                          <ListingControls
                            assetId={asset.id}
                            status={status}
                            showButtons={!contract && status !== "personal_use"}
                            links={listingLinks(asset)}
                            labels={{
                              rented: t(locale, "mark_rented"),
                              vacant: t(locale, "mark_vacant"),
                            }}
                          />
                        )}
                        {asset.category === "real_estate" && status !== "personal_use" && (
                          <DoorKey
                            assetId={asset.id}
                            code={asset.doorCode}
                            phone={contract?.tenantPhone?.replace(/\D/g, "") || null}
                            message={`${displayName(asset)}${asset.address ? ` (${asset.address})` : ""} — ${t(locale, "door_key")}:`}
                            labels={{
                              key: t(locale, "door_key"),
                              generate: t(locale, "door_generate"),
                            }}
                          />
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          </section>
          ) };
          }),
          { group: "digital", empty: cryptoRows.length === 0 && stockRows.length === 0 && metalRows.length === 0, addHref: "/assets/new?category=crypto", node: (
      <section data-tour="digital">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 style={{ marginBottom: 0 }}>
            {t(locale, "section_digital")}
            {digitalValueUsd > 0 && (
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: 14 }}>
                {" "}· ${Math.round(digitalValueUsd).toLocaleString("en-US")} ≈ {money(digitalValueGel)}
              </span>
            )}
          </h2>
        </div>

        {cryptoRows.length === 0 && stockRows.length === 0 && metalRows.length === 0 && (
          <p className="hint" style={{ marginTop: 10 }}>{t(locale, "digital_empty")}</p>
        )}

        <HoldingTable
          locale={locale} money={money} heading={t(locale, "section_crypto")}
          subUsd={cryptoValueUsd} subGel={cryptoValueGel}
          holdingsLabel={t(locale, "holding_quantity")} qtyDigits={8} rows={cryptoRows}
        />
        <HoldingTable
          locale={locale} money={money} heading={t(locale, "section_stock")}
          subUsd={stockValueUsd} subGel={stockValueGel}
          holdingsLabel={t(locale, "holding_quantity")} qtyDigits={4} rows={stockRows}
        />
        <HoldingTable
          locale={locale} money={money} heading={t(locale, "section_metal")}
          subUsd={metalValueUsd} subGel={metalValueGel}
          holdingsLabel={t(locale, "holding_quantity")} qtyDigits={4} rows={metalRows}
        />

        {(cryptoRows.length > 0 || stockRows.length > 0 || metalRows.length > 0) && (
          <p className="hint" style={{ marginTop: 10 }}>{t(locale, "digital_footnote")}</p>
        )}
      </section>
          ) },
          { group: "income", empty: assets.filter((a) => a.category === "income_source").length === 0, addHref: "/assets/new?category=income_source", node: (() => {
        const incomeAssets = assets.filter((a) => a.category === "income_source");
        return (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 style={{ marginBottom: 0 }}>{t(locale, "section_income")}</h2>
            </div>
            {incomeAssets.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", marginTop: 12 }}>
                {t(locale, "no_items_yet")}
              </p>
            ) : (
              <div className="card card--stack" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t(locale, "unit_name")}</th>
                      <th>{t(locale, "unit_type")}</th>
                      <th className="num">{t(locale, "income_monthly")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {incomeAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <Link href={`/assets/${asset.id}/edit`} className="link">
                            {displayName(asset)}
                          </Link>
                        </td>
                        <td data-label={t(locale, "unit_type")}>
                          <span className="badge badge--rented">
                            {t(locale, `type_${asset.type}` as StringKey)}
                          </span>
                        </td>
                        <td className="num" data-label={t(locale, "income_monthly")} style={{ fontWeight: 600 }}>
                          {money(asset.monthlyIncome ?? 0)} / {t(locale, "per_month_word")}
                        </td>
                        <td className="num">
                          <Link href={`/assets/${asset.id}/edit`} className="link">
                            {t(locale, "edit")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })() },
        ]}
        ctaText={t(locale, "add_cta")}
      />
    </main>
  );
}
