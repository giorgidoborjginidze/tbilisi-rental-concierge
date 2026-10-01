import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { dayKey, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { rentLabel } from "@/lib/rentals/display";
import { asFleetSort, loadFleetRows, sortFleet } from "@/lib/fleet/rows";
import { toCsv } from "@/lib/fleet/csv";
import { payableAmount } from "@/lib/rentals/money";

// The fleet table as a spreadsheet (/fleet → "Excel"), in the table's order.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const operator = await getSessionOperator();
  if (!operator) return new Response("Not found", { status: 404 });
  const locale = await getLocale();
  const now = new Date();
  const rows = sortFleet(
    await loadFleetRows(operator.id, startOfTodayTbilisi(now), now),
    asFleetSort(new URL(request.url).searchParams.get("sort")),
  );
  const fmtTime = tbilisiFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const name = (a: { name: string; nameKa: string | null }) => (locale === "ka" && a.nameKa ? a.nameKa : a.name);
  const csv = toCsv([
    [
      t(locale, "fleet_col_car"), t(locale, "asset_plate"), t(locale, "fleet_col_driver"), t(locale, "invoice_phone"),
      t(locale, "fleet_col_rent"), t(locale, "fleet_col_end"), t(locale, "fleet_col_paid"), t(locale, "fleet_col_owed"),
      t(locale, "contract_currency"), t(locale, "fleet_col_days_late"), t(locale, "fleet_col_tracker"), t(locale, "fence_status_outside"),
    ],
    ...rows.map((row) => [
      name(row.vehicle),
      row.vehicle.plateNumber ?? "",
      row.running?.tenantName ?? "",
      // Digits in groups, no "+": a spreadsheet keeps it as text, not a number or a formula.
      (row.running?.tenantPhone ?? "").replace(/[^\d]/g, "").replace(/(\d{3})(\d{3})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5"),
      row.running ? rentLabel(locale, row.running) : "",
      row.running ? dayKey(row.running.endDate) : "",
      row.status ? dayKey(row.status.paidThrough) : "",
      row.owes && row.status ? payableAmount(row.status.amountDue) : 0,
      row.money?.currency ?? "",
      row.owes && row.status ? row.status.daysOverdue : 0,
      row.lastPingAt ? fmtTime.format(row.lastPingAt) : "",
      row.outside ? "1" : "",
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activo-fleet-${dayKey(startOfTodayTbilisi(now))}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
