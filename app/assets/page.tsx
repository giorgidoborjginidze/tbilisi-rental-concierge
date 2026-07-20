import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { proratedRevenue } from "@/lib/analytics/metrics";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import { LISTING_PLATFORMS } from "@/lib/types";
import IncomeSection from "./income-section";
import ListingControls, { type ListingLink } from "./listing-controls";
import DoorKey from "./door-key";

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

export default async function AssetsPage() {
  const operator = await requireOperator();

  const locale = await getLocale();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [assets, monthBookings, monthIncomes] = await Promise.all([
    prisma.asset.findMany({
      where: { operatorId: operator.id },
      include: {
        contracts: { orderBy: { endDate: "desc" } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        checkIn: { lt: monthEnd },
        checkOut: { gt: monthStart },
        unit: { operatorId: operator.id },
      },
    }),
    prisma.incomeRecord.findMany({
      where: { operatorId: operator.id },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const activeContract = (asset: (typeof assets)[number]) =>
    asset.contracts.find(
      (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
    );

  const effectiveStatus = (asset: (typeof assets)[number]) =>
    activeContract(asset) ? "rented" : asset.unitId ? "str" : asset.status;

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

  // Income consolidation for the current month.
  const rentIncome = assets.reduce((sum, asset) => {
    const contract = activeContract(asset);
    return sum + (contract?.monthlyRent ?? 0);
  }, 0);
  // Recurring income streams registered as assets (salary, dividend, …).
  const otherIncomeSources = assets.reduce(
    (sum, asset) =>
      asset.category === "income_source" ? sum + (asset.monthlyIncome ?? 0) : sum,
    0,
  );
  const strIncome = monthBookings.reduce(
    (sum, b) => sum + proratedRevenue(b, { start: monthStart, end: monthEnd }),
    0,
  );
  const manualIncomeThisMonth = monthIncomes
    .filter((r) => r.date >= monthStart && r.date < monthEnd)
    .reduce((sum, r) => sum + r.amount, 0);
  const totalMonthly =
    rentIncome + strIncome + manualIncomeThisMonth + otherIncomeSources;

  const totalValue = assets.reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0);
  const rentedCount = assets.filter((a) => effectiveStatus(a) === "rented").length;

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

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDate = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" });
  const money = (v: number) => `${Math.round(v).toLocaleString("en-US")} GEL`;
  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "assets_title")}</h1>
        <Link href="/assets/new" className="btn-primary">
          {t(locale, "assets_add")}
        </Link>
      </div>

      <section className="kpi-grid">
        <Kpi label={t(locale, "assets_total_value")} value={money(totalValue)} />
        <Kpi
          label={t(locale, "assets_monthly_income")}
          value={money(totalMonthly)}
          sub={`${t(locale, "income_rent_short")}: ${money(rentIncome)} · STR: ${money(strIncome)} · ${t(locale, "income_other_short")}: ${money(manualIncomeThisMonth + otherIncomeSources)}`}
        />
        <Kpi
          label={t(locale, "assets_rented_count")}
          value={`${rentedCount} / ${assets.length}`}
        />
        <Kpi label={t(locale, "income_str_derived")} value={money(strIncome)} />
      </section>

      {assets.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "assets_empty")}</p>
      ) : (
        <div className="card card--stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_type")}</th>
                <th>{t(locale, "status_label")}</th>
                <th>{t(locale, "contracts_col")}</th>
                <th className="num">{t(locale, "market_rent_est")}</th>
                <th className="num">{t(locale, "asset_value_col")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const isIncome = asset.category === "income_source";
                const contract = activeContract(asset);
                const status = effectiveStatus(asset);
                const benchmark = asset.district
                  ? rentBenchmarks.get(asset.district) ?? null
                  : null;
                const marketRent =
                  asset.category === "real_estate"
                    ? estimateMarketRent(asset.areaSqm, benchmark)
                    : null;
                const belowMarket =
                  contract && marketRent && contract.monthlyRent < marketRent * 0.85;

                return (
                  <tr key={asset.id}>
                    <td>
                      <div>{displayName(asset)}</div>
                      <div className="cell-sub">
                        {[asset.district, asset.address].filter(Boolean).join(" · ")}
                        {asset.unit && (
                          <>
                            {" "}
                            <Link href={`/calendar?unit=${asset.unit.id}`} className="link">
                              ({asset.unit.name})
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td data-label={t(locale, "unit_type")}>
                      {t(locale, `type_${asset.type}` as StringKey)}
                      {asset.rentalMode === "daily" && !isIncome && (
                        <>
                          {" "}
                          <span className="badge badge--str">
                            {t(locale, "mode_daily")}
                          </span>
                        </>
                      )}
                    </td>
                    <td data-label={t(locale, "status_label")}>
                      {isIncome ? (
                        <span className="badge badge--rented">
                          {t(locale, "income_recurring")}
                        </span>
                      ) : (
                        <>
                          <span
                            className={`badge ${STATUS_BADGE[status] ?? STATUS_BADGE.personal_use}`}
                          >
                            {t(locale, `status_${status}` as StringKey)}
                          </span>
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
                        </>
                      )}
                    </td>
                    <td data-label={t(locale, "contracts_col")} style={{ fontWeight: 400 }}>
                      {isIncome ? (
                        <span style={{ fontWeight: 600 }}>
                          {money(asset.monthlyIncome ?? 0)} / {t(locale, "per_month_word")}
                        </span>
                      ) : contract ? (
                        <div>
                          <div>
                            {contract.monthlyRent} {contract.currency} ·{" "}
                            {contract.tenantName ?? "—"}
                          </div>
                          <div className="cell-sub">
                            {t(locale, "contract_until")}: {fmtDate.format(contract.endDate)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
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
                    </td>
                    <td className="num" data-label={t(locale, "market_rent_est")}>
                      {marketRent ? (
                        <div>
                          <span style={{ color: "var(--color-text-muted)" }}>
                            ~{marketRent} GEL
                          </span>
                          {belowMarket && (
                            <div style={{ marginTop: 4 }}>
                              <span className="badge badge--vacant">
                                {t(locale, "below_market")}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="num" data-label={t(locale, "asset_value_col")}>
                      {asset.estimatedValue ? money(asset.estimatedValue) : "—"}
                    </td>
                    <td className="num">
                      <Link href={`/assets/${asset.id}/edit`} className="link">
                        {t(locale, "edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <IncomeSection
        locale={locale}
        incomes={monthIncomes.map((r) => ({
          id: r.id,
          source: r.source,
          description: r.description,
          date: fmtDate.format(r.date),
          amount: r.amount,
          currency: r.currency,
        }))}
      />
    </main>
  );
}
