import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { tbilisiFormat } from "@/lib/time";
import BookingEditForm from "./booking-edit-form";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("booking_edit_title");

const SOURCE_NAME: Record<string, string> = { airbnb: "Airbnb", booking: "Booking.com" };

// One stay: its price and guest name (always), its dates (when entered by
// hand — an imported stay's dates follow its channel), and cancel/restore.
export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const { id } = await params;
  const back = firstParam((await searchParams).back);
  const booking = await prisma.booking.findFirst({
    where: { id, unit: { operatorId: operator.id } },
    include: { unit: { select: { id: true, name: true, nameKa: true } } },
  });
  if (!booking) notFound();

  const locale = await getLocale();
  const imported = booking.externalId != null;
  const cancelled = booking.status === "cancelled";
  const source =
    SOURCE_NAME[booking.source] ??
    t(locale, booking.source === "direct" ? "source_direct" : "source_manual");
  const day = tbilisiFormat(locale, { day: "numeric", month: "long", year: "numeric" });
  const labelKeys: StringKey[] = [
    "booking_guest", "booking_check_in", "booking_check_out", "booking_amount_total",
    "save", "cancel", "error_required", "error_invalid_number", "error_dates",
    "error_booking_overlap", "booking_cancel_stay", "booking_cancel_confirm",
    "booking_restore",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));
  const unitName = locale === "ka" && booking.unit.nameKa ? booking.unit.nameKa : booking.unit.name;

  return (
    <main>
      <div className="auth-box" style={{ maxWidth: 480 }}>
        <h1>{t(locale, "booking_edit_title")}</h1>
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
          <Link
            href={`/calendar?unit=${booking.unit.id}&month=${booking.checkIn.toISOString().slice(0, 7)}`}
            className="link"
          >
            {unitName}
          </Link>{" "}
          · {source}
        </p>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
          {day.format(booking.checkIn)} – {day.format(booking.checkOut)} · {booking.nights}{" "}
          {t(locale, "nights_short")}
        </p>
        {cancelled && (
          <p style={{ margin: "8px 0 0" }}>
            <span className="badge badge--muted">{t(locale, "booking_status_cancelled")}</span>
            {booking.cancelReason && (
              <span style={{ marginLeft: 6, fontSize: 13, color: "var(--color-text-muted)" }}>
                {t(locale, `booking_cancel_reason_${booking.cancelReason}` as StringKey)}
              </span>
            )}
          </p>
        )}
        {imported && (
          <p className="field-hint" style={{ marginTop: 10 }}>
            {t(locale, "booking_imported_note").replace("{source}", source)}
          </p>
        )}
        <BookingEditForm
          labels={labels}
          booking={{
            id: booking.id,
            guestName: booking.guestName ?? "",
            amount: booking.amount == null ? "" : String(booking.amount),
            checkIn: booking.checkIn.toISOString().slice(0, 10),
            checkOut: booking.checkOut.toISOString().slice(0, 10),
            currency: booking.currency,
          }}
          datesEditable={!imported}
          cancelled={cancelled}
          backHref={
            back === "calendar"
              ? `/calendar?unit=${booking.unit.id}&month=${booking.checkIn.toISOString().slice(0, 7)}`
              : "/bookings"
          }
        />
      </div>
    </main>
  );
}
