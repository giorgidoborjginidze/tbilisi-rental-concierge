import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { proratedRevenue } from "@/lib/analytics/metrics";
import { estimateMarketRent, getRentBenchmark } from "@/lib/market/rent";
import IncomeSection from "./income-section";
import ListingControls from "./listing-controls";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  rented: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  str: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  vacant: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  personal_use: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  listed: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
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

  // Income consolidation for the current month.
  const rentIncome = assets.reduce((sum, asset) => {
    const contract = activeContract(asset);
    return sum + (contract?.monthlyRent ?? 0);
  }, 0);
  const strIncome = monthBookings.reduce(
    (sum, b) => sum + proratedRevenue(b, { start: monthStart, end: monthEnd }),
    0,
  );
  const manualIncomeThisMonth = monthIncomes
    .filter((r) => r.date >= monthStart && r.date < monthEnd)
    .reduce((sum, r) => sum + r.amount, 0);
  const totalMonthly = rentIncome + strIncome + manualIncomeThisMonth;

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
    <main className="mx-auto w-full max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t(locale, "assets_title")}</h1>
        <Link
          href="/assets/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {t(locale, "assets_add")}
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label={t(locale, "assets_total_value")} value={money(totalValue)} />
        <Kpi
          label={t(locale, "assets_monthly_income")}
          value={money(totalMonthly)}
          sub={`${t(locale, "income_rent_derived")}: ${money(rentIncome)} · STR: ${money(strIncome)} · ${t(locale, "income_manual")}: ${money(manualIncomeThisMonth)}`}
        />
        <Kpi
          label={t(locale, "assets_rented_count")}
          value={`${rentedCount} / ${assets.length}`}
        />
        <Kpi label={t(locale, "income_str_derived")} value={money(strIncome)} />
      </section>

      {assets.length === 0 ? (
        <p className="text-neutral-500">{t(locale, "assets_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium">{t(locale, "unit_name")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "unit_type")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "status_label")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "contracts_title")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "market_rent_est")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "asset_value")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
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
                  <tr key={asset.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-4 py-3">
                      <div>{displayName(asset)}</div>
                      <div className="text-xs text-neutral-500">
                        {[asset.district, asset.address].filter(Boolean).join(" · ")}
                        {asset.unit && (
                          <>
                            {" "}
                            <Link
                              href={`/calendar?unit=${asset.unit.id}`}
                              className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                              ({asset.unit.name})
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t(locale, `type_${asset.type}` as StringKey)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.personal_use}`}
                      >
                        {t(locale, `status_${status}` as StringKey)}
                      </span>
                      {status !== "str" && (
                        <ListingControls
                          assetId={asset.id}
                          status={status}
                          showButtons={!contract}
                          myhomeUrl={asset.myhomeUrl}
                          labels={{
                            rented: t(locale, "mark_rented"),
                            vacant: t(locale, "mark_vacant"),
                            open: t(locale, "myhome_open"),
                          }}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contract ? (
                        <div>
                          <div>
                            {contract.monthlyRent} {contract.currency} ·{" "}
                            {contract.tenantName ?? "—"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {t(locale, "contract_until")}: {fmtDate.format(contract.endDate)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {marketRent ? (
                        <div>
                          <span className="text-neutral-600 dark:text-neutral-400">
                            ~{marketRent} GEL
                          </span>
                          {belowMarket && (
                            <div className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              {t(locale, "below_market")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {asset.estimatedValue ? money(asset.estimatedValue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/assets/${asset.id}/edit`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
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
