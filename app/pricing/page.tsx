import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { computeSuggestionsForUnit } from "@/lib/pricing/run";
import UnitFilter from "../calendar/unit-filter";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

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
    <main className="mx-auto w-full max-w-4xl p-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t(locale, "pricing_title")}</h1>
        <UnitFilter
          basePath="/pricing"
          units={units.map((u) => ({ id: u.id, label: displayName(u) }))}
          selected={selected.id}
        />
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        {t(locale, "pricing_intro")} · {t(locale, "base_rate_short")}:{" "}
        {selected.baseNightlyRate} {selected.currency}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">{t(locale, "pricing_date")}</th>
              <th className="px-4 py-3 font-medium text-right">
                {t(locale, "pricing_suggested")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {t(locale, "pricing_benchmark")}
              </th>
              <th className="px-4 py-3 font-medium">{t(locale, "pricing_rationale")}</th>
            </tr>
          </thead>
          <tbody>
            {(suggestions ?? []).map((row) => {
              const delta = row.result.suggestedRate - selected.baseNightlyRate;
              return (
                <tr
                  key={row.date.toISOString()}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="px-4 py-3">{fmtDay.format(row.date)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium">
                      {row.result.suggestedRate} {selected.currency}
                    </span>{" "}
                    <span
                      className={
                        delta > 0
                          ? "text-xs text-emerald-600"
                          : delta < 0
                            ? "text-xs text-red-500"
                            : "text-xs text-neutral-400"
                      }
                    >
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "="}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {row.result.factors.benchmarkAdr ?? "—"}
                    {row.result.underpriced && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        {t(locale, "pricing_underpriced")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
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
