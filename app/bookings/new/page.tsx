import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import BookingForm from "./booking-form";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const operator = await requireOperator();

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
    "error_email_taken",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return (
    <main>
      <div className="auth-box" style={{ maxWidth: 480 }}>
      <h1>{t(locale, "booking_new_title")}</h1>
      <BookingForm
        labels={labels}
        units={units.map((unit) => ({
          id: unit.id,
          label: `${locale === "ka" && unit.nameKa ? unit.nameKa : unit.name} (${unit.city})`,
        }))}
      />
      </div>
    </main>
  );
}
