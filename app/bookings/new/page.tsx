import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import BookingForm from "./booking-form";
import { firstParam, type QueryValue } from "@/lib/params";
import { cityLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("booking_new_title");

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const unitParam = firstParam((await searchParams).unit);

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, nameKa: true, city: true },
  });

  const labelKeys: StringKey[] = [
    "booking_unit", "booking_source", "source_manual", "source_direct",
    "booking_guest", "booking_check_in", "booking_check_out", "booking_amount",
    "save", "cancel", "error_required", "error_invalid_number", "error_dates",
    "error_booking_overlap",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return (
    <main>
      <div className="auth-box" style={{ maxWidth: 480 }}>
      <h1>{t(locale, "booking_new_title")}</h1>
      {units.length === 0 ? (
        // A stay needs its place first — a unit, or a flat under Assets
        // let by the day (which gets its unit when saved).
        <div className="alert-card alert-card--info" style={{ display: "block" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>{t(locale, "booking_no_units")}</div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
            <Link href="/units/new" className="btn-primary btn-compact">{t(locale, "units_add")}</Link>
            <Link href="/units" className="btn-chip">{t(locale, "units_title")}</Link>
          </div>
        </div>
      ) : (
      <BookingForm
        labels={labels}
        defaultUnitId={units.some((unit) => unit.id === unitParam) ? unitParam : undefined}
        units={units.map((unit) => ({
          id: unit.id,
          label: `${locale === "ka" && unit.nameKa ? unit.nameKa : unit.name} (${cityLabel(locale, unit.city)})`,
        }))}
      />
      )}
      </div>
    </main>
  );
}
