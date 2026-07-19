import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { parseChannelLinks } from "@/lib/types";
import { syncNow } from "@/lib/bookings/actions";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const operator = await requireOperator();

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    include: { _count: { select: { bookings: true, leases: true } } },
    orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
  });

  return (
    <main>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "units_title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <form action={syncNow}>
            <button type="submit" className="btn-secondary">
              {t(locale, "sync_now")}
            </button>
          </form>
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
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_district")}</th>
                <th>{t(locale, "unit_type")}</th>
                <th className="num">{t(locale, "base_rate_short")}</th>
                <th className="num">{t(locale, "bookings")}</th>
                <th style={{ textAlign: "center" }}>iCal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const links = parseChannelLinks(unit.channelLinks);
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
                    <td>{unit.district}</td>
                    <td>{t(locale, `type_${unit.type}` as StringKey)}</td>
                    <td className="num">
                      {unit.baseNightlyRate} {unit.currency}
                    </td>
                    <td className="num">{unit._count.bookings}</td>
                    <td style={{ textAlign: "center" }}>
                      {links.icalUrls.length > 0 ? links.icalUrls.length : "—"}
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
