import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey, type Locale } from "@/lib/i18n/strings";
import { monthlyIncome } from "@/lib/analytics/monthly-income";
import { incomeParts } from "@/lib/analytics/income-display";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { getNetWorth, type HoldingLine } from "@/lib/wealth/net-worth";
import { isHolding } from "@/lib/wealth/compose";
import { priceAge, rateLine } from "@/lib/prices/labels";
import Approx from "../approx";
import { LISTING_PLATFORMS } from "@/lib/types";
import ListingControls, { type ListingLink } from "./listing-controls";
import DoorKey from "./door-key";
import AssetSegments from "./asset-segments";
import AssetFlipCard, { type FlipAsset } from "./asset-flip-card";
import { lateContract, statusFor } from "@/lib/rentals/terms";
import { activeContract as runningContract, assetStatusNow } from "@/lib/rentals/phase";
import { rentLabel } from "@/lib/rentals/display";
import { monthKeyTbilisi, monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import RevenuePartial, { monthKeyOf } from "../revenue-partial";
import { districtLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";
import { formatMoney, formatNumber, formatQuantity, formatSignedPercent } from "@/lib/format";
import { deskHref, rentalDesk } from "@/lib/rentals/desk";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import Kpi from "../kpi";

// What can be let to someone with a contract.
const CONTRACT_CATEGORIES = ["real_estate", "vehicle", "other"];

export const dynamic = "force-dynamic";

export const generateMetadata = titled("assets_title");

const STATUS_BADGE: Record<string, string> = {
  rented: "badge--rented",
  str: "badge--str",
  vacant: "badge--vacant",
  personal_use: "badge--personal",
  listed: "badge--listed",
};

// One holding sub-table (crypto / stock / metal) inside Digital Assets.
// Every row says where its price comes from: live (nothing added), the
// last known price with its age, or no price (valued at what was paid).
function HoldingTable({
  locale, heading, lines, qtyDigits, approxLabel, now,
}: {
  locale: Locale;
  heading: string;
  lines: HoldingLine[];
  qtyDigits: number;
  approxLabel: string;
  now: Date;
}) {
  if (lines.length === 0) return null;
  // Prices are in dollars, written like every other amount: "1,250 $".
  const d = (n: number | null, dp = 2) => formatMoney(n, "USD", dp);
  const subUsd = lines.reduce((sum, line) => sum + line.valueUsd, 0);
  const subGel = lines.reduce((sum, line) => sum + line.valueGel, 0);
  const approx = lines.some((line) => line.valuation.quantity > 0 && line.basis !== "live");
  const holdingsLabel = t(locale, "holding_quantity");
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 0 }}>
        {heading}
        {subUsd > 0 && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: 13 }}>
            {" "}· {approx && <Approx label={approxLabel} />}
            {formatMoney(subUsd, "USD")} · {formatMoney(subGel)}
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
            {lines.map((line) => {
              const v = line.valuation;
              const pc = v.profit == null ? undefined : v.profit >= 0 ? "var(--status-rented-text)" : "var(--status-danger-text)";
              const held = v.quantity > 0;
              return (
                <tr key={line.id}>
                  <td>
                    <Link href={`/assets/${line.id}/edit`} className="link">{line.name}</Link>
                    <div className="cell-sub">{line.symbol}</div>
                  </td>
                  <td className="num" data-label={holdingsLabel}>
                    {formatNumber(v.quantity, qtyDigits)}
                  </td>
                  <td className="num" data-label={t(locale, "crypto_avg_price")}>{held ? d(v.avgBuyPrice) : "—"}</td>
                  <td className="num" data-label={t(locale, "crypto_current_price")}>
                    {line.quote ? d(line.quote.price) : "—"}
                    {line.basis === "stale" && line.quote && (
                      <div className="cell-sub price-age">
                        {t(locale, "price_last_known").replace("{age}", priceAge(locale, line.quote.fetchedAt, now))}
                      </div>
                    )}
                    {line.basis === "cost" && held && (
                      <div className="cell-sub price-age">{t(locale, "price_none")}</div>
                    )}
                  </td>
                  <td className="num" data-label={t(locale, "crypto_value")}>
                    {held && line.basis !== "live" && <Approx label={approxLabel} />}
                    {d(line.valueUsd, 0)}
                    {held && line.basis === "cost" && (
                      <div className="cell-sub price-age">{t(locale, "price_at_cost")}</div>
                    )}
                  </td>
                  <td className="num" data-label={t(locale, "crypto_pnl")} style={{ color: pc, fontWeight: 600 }}>
                    {v.profit == null || !held ? "—" : `${v.profit >= 0 ? "+" : ""}${d(v.profit, 0)}`}
                    {held && v.profitPct != null && (
                      <div className="cell-sub" style={{ color: pc }}>
                        {formatSignedPercent(v.profitPct)}
                      </div>
                    )}
                    {Math.abs(v.realizedProfit) >= 0.005 && (
                      <div className="cell-sub" style={{ fontWeight: 400 }}>
                        {t(locale, "holding_realized")}: {v.realizedProfit >= 0 ? "+" : ""}{d(v.realizedProfit, 0)}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <Link href={`/assets/${line.id}/edit`} className="link">{t(locale, "edit")}</Link>
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

// The page's one total: what the flats and cars are estimated at plus
// every holding in GEL — the same figure as the dashboard (getNetWorth).
// It streams in, so the property cards never wait on a price API.
async function TotalValueKpi({ locale, operatorId }: { locale: Locale; operatorId: string }) {
  const worth = await getNetWorth(operatorId);
  const approxLabel = t(locale, "approx_word");
  return (
    <Kpi
      label={t(locale, "assets_total_value")}
      value={
        <>
          {worth.approximate && <Approx label={approxLabel} />}
          {formatMoney(worth.total)}
        </>
      }
      sub={
        worth.holdingsBasis === "none"
          ? undefined
          : t(locale, "assets_total_parts")
              .replace("{p}", formatMoney(worth.physical))
              .replace("{d}", formatMoney(worth.holdings))
      }
    />
  );
}

// Crypto, shares and metals: valued with the stored-or-live prices.
async function DigitalHoldings({ locale, operatorId }: { locale: Locale; operatorId: string }) {
  const worth = await getNetWorth(operatorId);
  const now = new Date();
  const approxLabel = t(locale, "approx_word");
  const of = (kind: HoldingLine["kind"]) => worth.lines.filter((line) => line.kind === kind);
  const heldLines = worth.lines.filter((line) => line.valuation.quantity > 0);
  const allLive = heldLines.every((line) => line.basis === "live");
  const oversold = worth.lines.filter((line) => line.valuation.oversold > 0);
  return (
    <>
      <h2 style={{ marginBottom: 0 }}>
        {t(locale, "section_digital")}
        {worth.holdingsUsd > 0 && (
          <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: 14 }}>
            {" "}· {worth.approximate && <Approx label={approxLabel} />}
            {formatMoney(worth.holdingsUsd, "USD")} · {formatMoney(worth.holdings)}
          </span>
        )}
      </h2>

      {oversold.map((line) => (
        <p key={line.id} className="alert-card alert-card--warn" role="status" style={{ display: "block", fontSize: 13, marginTop: 10 }}>
          <Link href={`/assets/${line.id}/edit`} className="link">{line.name}</Link>:{" "}
          {t(locale, "holding_oversold").replace(
            "{n}",
            formatQuantity(line.valuation.oversold, line.kind),
          )}
        </p>
      ))}

      <HoldingTable locale={locale} heading={t(locale, "section_crypto")} lines={of("crypto")} qtyDigits={8} approxLabel={approxLabel} now={now} />
      <HoldingTable locale={locale} heading={t(locale, "section_stock")} lines={of("stock")} qtyDigits={4} approxLabel={approxLabel} now={now} />
      <HoldingTable locale={locale} heading={t(locale, "section_metal")} lines={of("metal")} qtyDigits={4} approxLabel={approxLabel} now={now} />

      {/* "Live" only when every price shown is; otherwise say what is not. */}
      {heldLines.length > 0 && (
        <p className="hint" style={{ marginTop: 10 }}>
          {allLive ? t(locale, "holdings_live_note") : t(locale, "holdings_stale_note")}{" "}
          {rateLine(locale, worth.rate, now)}
        </p>
      )}
    </>
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
        contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
        days: { where: { date: today, rented: true }, select: { id: true } },
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
        : assetStatusNow(asset, asset.contracts, today, { rentedToday: asset.days.length > 0 });

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

  const holdingCount = assets.filter((a) => isHolding(a.category)).length;

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
        "edit", "contracts_col", "contract_until", "contract_add",
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
        <Suspense fallback={<Kpi label={t(locale, "assets_total_value")} value={<span className="skel__block kpi-wait" />} />}>
          <TotalValueKpi locale={locale} operatorId={operator.id} />
        </Suspense>
        <Kpi
          label={t(locale, "income_all_month")}
          value={formatMoney(income.total)}
          sub={incomeParts(locale, income, (v) => formatMoney(v)) || t(locale, "income_all_hint")}
        />
      </section>
      <RevenuePartial
        locale={locale}
        nights={income.unpricedNights}
        month={monthKeyOf(monthStartTbilisi(0))}
        adr={false}
      />

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
                const desk = rentalDesk(asset.category, asset.contracts.length);
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
                  district: districtLabel(locale, asset.district) || null,
                  address: asset.address,
                  typeLabel: t(locale, `type_${asset.type}` as StringKey),
                  statusLabel: t(locale, `status_${status}` as StringKey),
                  statusClass: STATUS_BADGE[status] ?? STATUS_BADGE.personal_use,
                  contract: contract
                    ? `${rentLabel(locale, contract)} · ${contract.tenantName ?? "—"}`
                    : null,
                  contractUntil: contract ? fmtDate.format(contract.endDate) : null,
                  marketRent: marketRent ? `~${formatMoney(marketRent)}` : null,
                  belowMarket: Boolean(
                    contract && marketRent && contract.monthlyRent < marketRent * 0.85,
                  ),
                  value: asset.estimatedValue ? formatMoney(asset.estimatedValue) : null,
                  daily: asset.rentalMode === "daily",
                  // The running contract when late, else a finished one
                  // that still has rent owed.
                  overdue: overdueBadge(lateContract(asset.contracts, today, asset), asset),
                  // Only what is rented out has a service desk; late rent
                  // on the card's face opens its payments directly.
                  serviceHref: desk ? deskHref(asset.id, desk) : null,
                  overdueHref: desk ? deskHref(asset.id, desk, "payments") : null,
                  category: asset.category,
                  // "Rented" with no contract behind it: offer to add one —
                  // but not for a day let, whose "rented" is today's answer.
                  addContractHref:
                    status === "rented" &&
                    !contract &&
                    asset.rentalMode !== "daily" &&
                    asset.days.length === 0 &&
                    CONTRACT_CATEGORIES.includes(asset.category)
                      ? `/assets/${asset.id}/edit?add=contract#contracts`
                      : null,
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
          { group: "digital", empty: holdingCount === 0, addHref: "/assets/new?category=crypto", node: (
      <section data-tour="digital">
        {holdingCount === 0 ? (
          <>
            <h2 style={{ marginBottom: 0 }}>{t(locale, "section_digital")}</h2>
            <p className="hint" style={{ marginTop: 10 }}>{t(locale, "digital_empty")}</p>
          </>
        ) : (
          <Suspense
            fallback={
              <>
                <h2 style={{ marginBottom: 0 }}>{t(locale, "section_digital")}</h2>
                <div className="skel__block skel__card" style={{ height: 160, marginTop: 14 }} aria-busy="true" />
              </>
            }
          >
            <DigitalHoldings locale={locale} operatorId={operator.id} />
          </Suspense>
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
                          <span className="badge badge--tag">
                            {t(locale, `type_${asset.type}` as StringKey)}
                          </span>
                        </td>
                        <td className="num" data-label={t(locale, "income_monthly")} style={{ fontWeight: 600 }}>
                          {formatMoney(asset.monthlyIncome ?? 0)} / {t(locale, "per_month_word")}
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
