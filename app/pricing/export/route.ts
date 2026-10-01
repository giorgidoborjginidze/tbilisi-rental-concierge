import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { computeSuggestionsForUnit } from "@/lib/pricing/run";
import { suggestionsCsv } from "@/lib/pricing/csv";

// "Copy prices": the next 60 nights of one unit's suggestions as a CSV
// file, to paste into Airbnb, Booking.com or the owner's own sheet. Only
// the signed-in workspace's own units.
export async function GET(request: NextRequest) {
  const operator = await getSessionOperator();
  if (!operator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const unitId = request.nextUrl.searchParams.get("unit") ?? "";
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, operatorId: operator.id },
    select: { id: true, name: true, currency: true },
  });
  if (!unit) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const locale = await getLocale();
  const rows = (await computeSuggestionsForUnit(unit.id, locale, 60)) ?? [];
  const csv = suggestionsCsv(
    [t(locale, "csv_date"), t(locale, "csv_price"), t(locale, "csv_currency"), t(locale, "csv_reason")],
    rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      price: row.result.suggestedRate,
      currency: unit.currency,
      reason: row.rationale,
    })),
  );
  const file = `activo-prices-${unit.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || unit.id}.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
