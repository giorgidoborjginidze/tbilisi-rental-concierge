import { prisma } from "@/lib/db";

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

  if (!operator) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">STR Operator Dashboard</h1>
        <p className="mt-4 text-neutral-500">
          No data yet — run <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npx prisma db seed</code> to load the sample portfolio.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">STR Operator Dashboard</h1>
        <p className="mt-1 text-neutral-500">
          {operator.name} · {operator.units.length} units · {bookingCount} bookings · {benchmarkCount} benchmark rows
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">District</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Base rate</th>
              <th className="px-4 py-3 font-medium text-right">Bookings</th>
              <th className="px-4 py-3 font-medium text-right">Leases</th>
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
                <td className="px-4 py-3">{unit.type}</td>
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
