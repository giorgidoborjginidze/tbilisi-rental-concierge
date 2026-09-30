import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { feedUrlsOf } from "@/lib/ical/run-sync";
import RentalsSubnav from "../rentals-subnav";
import FeedStatus from "./feed-status";
import SyncButton from "./sync-button";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const operator = await requireOperator();

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    include: {
      _count: { select: { bookings: true, leases: true } },
      feeds: true,
    },
    orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
  });

  return (
    <main>
      <RentalsSubnav active="units" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "units_title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SyncButton
            labels={{
              sync_now: t(locale, "sync_now"),
              sync_running: t(locale, "sync_running"),
              sync_done: t(locale, "sync_done"),
              sync_done_errors: t(locale, "sync_done_errors"),
              sync_none: t(locale, "sync_none"),
              sync_demo: t(locale, "sync_demo"),
            }}
          />
          <Link href="/bookings/new" className="btn-secondary">
            {t(locale, "bookings_add")}
          </Link>
          <Link href="/units/new" className="btn-primary">
            {t(locale, "units_add")}
          </Link>
        </div>
      </div>

      {units.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "units_empty")}</p>
      ) : (
        <div className="card card--stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_district")}</th>
                <th>{t(locale, "unit_type")}</th>
                <th className="num">{t(locale, "base_rate_short")}</th>
                <th className="num">{t(locale, "bookings")}</th>
                <th className="ical-cell">iCal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const urls = feedUrlsOf(unit.channelLinks);
                const displayName =
                  locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
                return (
                  <tr key={unit.id}>
                    <td>
                      <div>{displayName}</div>
                      <div className="cell-sub">
                        {unit.city} · {unit.address}
                      </div>
                    </td>
                    <td data-label={t(locale, "unit_district")}>{unit.district}</td>
                    <td data-label={t(locale, "unit_type")}>{t(locale, `type_${unit.type}` as StringKey)}</td>
                    <td className="num" data-label={t(locale, "base_rate_short")}>
                      {unit.baseNightlyRate} {unit.currency}
                    </td>
                    <td className="num" data-label={t(locale, "bookings")}>{unit._count.bookings}</td>
                    <td data-label="iCal" className="ical-cell">
                      {urls.length > 0 ? (
                        <FeedStatus locale={locale} urls={urls} feeds={unit.feeds} compact />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">
                      <Link href={`/units/${unit.id}/edit`} className="link">
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
    </main>
  );
}
