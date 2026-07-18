import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const operator = await prisma.operator.findFirst({
    include: {
      units: {
        include: { _count: { select: { bookings: true, leases: true } } },
        orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
      },
    },
  });

  const [bookingCount, benchmarkCount] = await Promise.all([
    prisma.booking.count(),
    prisma.marketBenchmark.count(),
  ]);

  if (!operator) redirect("/onboarding");

  const locale = await getLocale();

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">{t(locale, "appName")}</h1>
        <p className="mt-1 text-neutral-500">
          {operator.name} · {operator.units.length} units · {bookingCount} bookings · {benchmarkCount} benchmark rows
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">{t(locale, "unit_name")}</th>
              <th className="px-4 py-3 font-medium">{t(locale, "unit_city")}</th>
              <th className="px-4 py-3 font-medium">{t(locale, "unit_district")}</th>
              <th className="px-4 py-3 font-medium">{t(locale, "unit_type")}</th>
              <th className="px-4 py-3 font-medium text-right">{t(locale, "base_rate_short")}</th>
              <th className="px-4 py-3 font-medium text-right">{t(locale, "bookings")}</th>
              <th className="px-4 py-3 font-medium text-right">{t(locale, "leases")}</th>
            </tr>
          </thead>
          <tbody>
            {operator.units.map((unit) => (
              <tr key={unit.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-4 py-3">
                  <div>{unit.name}</div>
                  {unit.nameKa && <div className="text-xs text-neutral-500">{unit.nameKa}</div>}
                </td>
                <td className="px-4 py-3">{unit.city}</td>
                <td className="px-4 py-3">{unit.district}</td>
                <td className="px-4 py-3">{t(locale, `type_${unit.type}` as StringKey)}</td>
                <td className="px-4 py-3 text-right">
                  {unit.baseNightlyRate} {unit.currency}
                </td>
                <td className="px-4 py-3 text-right">{unit._count.bookings}</td>
                <td className="px-4 py-3 text-right">{unit._count.leases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
