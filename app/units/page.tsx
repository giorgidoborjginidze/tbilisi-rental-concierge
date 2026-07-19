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
    <main className="mx-auto w-full max-w-5xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t(locale, "units_title")}</h1>
        <div className="flex items-center gap-3">
          <form action={syncNow}>
            <button
              type="submit"
              className="rounded border border-line-strong bg-white px-4 py-2 text-sm shadow-card hover:bg-surface2"
            >
              {t(locale, "sync_now")}
            </button>
          </form>
          <Link
            href="/bookings/new"
            className="rounded border border-line-strong bg-white px-4 py-2 text-sm shadow-card hover:bg-surface2"
          >
            {t(locale, "bookings_add")}
          </Link>
          <Link
            href="/units/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-primary-dark"
          >
            {t(locale, "units_add")}
          </Link>
        </div>
      </div>

      {units.length === 0 ? (
        <p className="text-neutral-500">{t(locale, "units_empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface2 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t(locale, "unit_name")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "unit_district")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "unit_type")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "base_rate_short")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "bookings")}</th>
                <th className="px-4 py-3 font-medium text-center">iCal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const links = parseChannelLinks(unit.channelLinks);
                const displayName =
                  locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
                return (
                  <tr
                    key={unit.id}
                    className="border-t border-line"
                  >
                    <td className="px-4 py-3">
                      <div>{displayName}</div>
                      <div className="text-xs text-neutral-500">
                        {unit.city} · {unit.address}
                      </div>
                    </td>
                    <td className="px-4 py-3">{unit.district}</td>
                    <td className="px-4 py-3">
                      {t(locale, `type_${unit.type}` as StringKey)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {unit.baseNightlyRate} {unit.currency}
                    </td>
                    <td className="px-4 py-3 text-right">{unit._count.bookings}</td>
                    <td className="px-4 py-3 text-center">
                      {links.icalUrls.length > 0 ? links.icalUrls.length : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/units/${unit.id}/edit`}
                        className="text-primary hover:underline"
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
    </main>
  );
}
