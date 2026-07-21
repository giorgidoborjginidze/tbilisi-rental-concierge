import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { computeSuggestionsForUnit } from "@/lib/pricing/run";
import UnitFilter from "../calendar/unit-filter";
import RentalsSubnav from "../rentals-subnav";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const operator = await requireOperator();

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameKa: true, currency: true, baseNightlyRate: true },
  });
  if (units.length === 0) redirect("/units");

  const { unit: unitQuery } = await searchParams;
  const selected = units.find((u) => u.id === unitQuery) ?? units[0];
  const suggestions = await computeSuggestionsForUnit(selected.id, locale);

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDay = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  return (
    <main>
      <RentalsSubnav active="pricing" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "pricing_title")}</h1>
        <UnitFilter
          basePath="/pricing"
          units={units.map((u) => ({ id: u.id, label: displayName(u) }))}
          selected={selected.id}
        />
      </div>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        {t(locale, "pricing_intro")} · {t(locale, "base_rate_short")}:{" "}
        {selected.baseNightlyRate} {selected.currency}
      </p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t(locale, "pricing_date")}</th>
              <th className="num">{t(locale, "pricing_suggested")}</th>
              <th className="num">{t(locale, "pricing_benchmark")}</th>
              <th>{t(locale, "pricing_rationale")}</th>
            </tr>
          </thead>
          <tbody>
            {(suggestions ?? []).map((row) => {
              const delta = row.result.suggestedRate - selected.baseNightlyRate;
              return (
                <tr key={row.date.toISOString()}>
                  <td>{fmtDay.format(row.date)}</td>
                  <td className="num">
                    {row.result.suggestedRate} {selected.currency}{" "}
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          delta > 0
                            ? "var(--status-rented-text)"
                            : delta < 0
                              ? "var(--status-danger-text)"
                              : "var(--color-text-muted)",
                      }}
                    >
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "="}
                    </span>
                  </td>
                  <td className="num" style={{ color: "var(--color-text-muted)" }}>
                    {row.result.factors.benchmarkAdr ?? "—"}
                    {row.result.underpriced && (
                      <>
                        {" "}
                        <span className="badge badge--vacant">
                          {t(locale, "pricing_underpriced")}
                        </span>
                      </>
                    )}
                  </td>
                  <td style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
                    {row.rationale}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
