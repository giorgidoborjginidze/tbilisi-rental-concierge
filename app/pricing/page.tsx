import Link from "next/link";
import { redirect } from "next/navigation";
import { SeverityIcon } from "../alert-icon";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { computeSuggestionsForUnit } from "@/lib/pricing/run";
import { groupRuns, type PricingResult } from "@/lib/pricing/engine";
import UnitFilter from "../calendar/unit-filter";
import RentalsSubnav from "../rentals-subnav";
import { firstParam, type QueryValue } from "@/lib/params";
import { formatMoney } from "@/lib/format";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("pricing_title");

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameKa: true, currency: true, baseNightlyRate: true },
  });
  if (units.length === 0) redirect("/units");

  const unitQuery = firstParam((await searchParams).unit);
  const selected = units.find((u) => u.id === unitQuery) ?? units[0];
  const suggestions = await computeSuggestionsForUnit(selected.id, locale);

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  // Stored dates are UTC midnight of the Tbilisi day: format them in UTC.
  const fmtDay = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  // Nights with the same price and reason read as one run.
  const runs = groupRuns(suggestions ?? []);
  const whole = (v: number) => Math.round(v).toLocaleString("en-US");
  const money = (v: number) => formatMoney(v, selected.currency);
  // The arithmetic behind a price, in the words of the page header.
  const maths = ({ steps, factors }: PricingResult) => {
    let line = t(locale, "pricing_math")
      .replace("{base}", whole(steps.base))
      .replace("{s}", steps.seasonality.toFixed(2))
      .replace("{d}", steps.demand.toFixed(2))
      .replace("{raw}", whole(steps.raw));
    if (steps.nudged != null) {
      line += t(locale, "pricing_math_nudge")
        .replace("{adr}", money(factors.benchmarkAdr ?? 0))
        .replace("{value}", whole(steps.nudged));
    }
    if (steps.capped) {
      line += t(locale, steps.capped === "floor" ? "pricing_math_floor" : "pricing_math_ceiling").replace(
        "{value}",
        whole(steps.final),
      );
    }
    return line;
  };

  const displayName = (unit: { name: string; nameKa: string | null }) =>
    locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;

  return (
    <main>
      <RentalsSubnav active="calendar" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "pricing_title")}</h1>
        <UnitFilter
          basePath="/pricing"
          units={units.map((u) => ({ id: u.id, label: displayName(u) }))}
          selected={selected.id}
        />
      </div>
      <p className="mb-5" style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        {t(locale, "pricing_intro")}
        {selected.baseNightlyRate > 0 && (
          <>
            {" · "}
            {t(locale, "base_rate_short")}: {formatMoney(selected.baseNightlyRate, selected.currency)}
          </>
        )}
      </p>

      {/* A unit made for a flat with no day rate has nothing to build on:
          say so, and where to set it, instead of an empty table. */}
      {selected.baseNightlyRate <= 0 ? (
        <div className="alert-card alert-card--info" style={{ alignItems: "center" }}>
          <span className="alert-card__notice">
            <SeverityIcon severity="info" />
            <span>{t(locale, "pricing_no_base_rate")}</span>
          </span>
          <Link href={`/units/${selected.id}/edit`} className="btn-primary btn-compact">
            {t(locale, "pricing_set_base_rate")}
          </Link>
        </div>
      ) : (
      // On a phone each night is a small card: the date, the price, the
      // district figure and the reason all in view (.table-stack).
      <div className="card table-stack">
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
            {runs.map((run, i) => {
              const row = run.first;
              const delta = row.result.suggestedRate - selected.baseNightlyRate;
              // The reason is written out when it changes, not on every row.
              const sameReason = i > 0 && runs[i - 1].last.rationale === row.rationale;
              return (
                <tr key={row.date.toISOString()}>
                  <td className="table-stack__title" style={{ minWidth: 150 }}>
                    <span style={{ whiteSpace: "nowrap" }}>{fmtDay.format(row.date)}</span>
                    {run.nights > 1 && (
                      <>
                        {" – "}
                        <span style={{ whiteSpace: "nowrap" }}>{fmtDay.format(run.last.date)}</span>
                      </>
                    )}
                    {run.nights > 1 && (
                      <div className="cell-sub">{t(locale, "pricing_nights").replace("{n}", String(run.nights))}</div>
                    )}
                  </td>
                  <td className="num table-stack__key" data-label={t(locale, "pricing_suggested")}>
                    {formatMoney(row.result.suggestedRate, selected.currency)}{" "}
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
                  <td
                    className="num"
                    data-label={t(locale, "pricing_benchmark")}
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {formatMoney(row.result.factors.benchmarkAdr, selected.currency)}
                    {row.result.underpriced && (
                      <>
                        {" "}
                        <span className="badge badge--warn">
                          {t(locale, "pricing_underpriced")}
                        </span>
                      </>
                    )}
                  </td>
                  <td
                    className="table-stack__wide"
                    data-label={t(locale, "pricing_rationale")}
                    style={{ color: "var(--color-text-muted)", fontWeight: 400 }}
                  >
                    {sameReason ? <span className="cell-sub">{t(locale, "pricing_same_reason")}</span> : row.rationale}
                    {/* The sum itself, so the price can be checked by hand. */}
                    <div className="cell-sub pricing-maths">{maths(row.result)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </main>
  );
}
