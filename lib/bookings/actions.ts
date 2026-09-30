"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { syncAllUnits } from "@/lib/ical/run-sync";
import type { FormState } from "@/lib/units/actions";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function createBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const unitId = str(formData, "unitId");
  const source = str(formData, "source") === "direct" ? "direct" : "manual";
  const guestName = str(formData, "guestName") || null;
  const checkInRaw = str(formData, "checkIn");
  const checkOutRaw = str(formData, "checkOut");

  if (!unitId || !checkInRaw || !checkOutRaw) return { error: "error_required" };

  const operator = await requireOperator();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, operatorId: operator.id },
  });
  if (!unit) return { error: "error_required" };

  const checkIn = new Date(`${checkInRaw}T00:00:00Z`);
  const checkOut = new Date(`${checkOutRaw}T00:00:00Z`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { error: "error_dates" };
  }
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
  );
  if (nights <= 0) return { error: "error_dates" };

  const amountRaw = str(formData, "amount");
  let amount: number | null = null;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: "error_invalid_number" };
    }
  }

  // A direct booking must never land on nights already sold on a channel
  // or let on a lease: that is the double booking the owner pays for.
  const clash = await firstClash(unitId, checkIn, checkOut);
  if (clash) return { error: "error_booking_overlap", detail: clash };

  await prisma.booking.create({
    data: {
      unitId,
      source,
      guestName,
      checkIn,
      checkOut,
      nights,
      amount,
      currency: unit.currency,
      status: "confirmed",
    },
  });

  revalidatePath("/units");
  revalidatePath("/");
  redirect("/units");
}

/** The first stay on the unit sharing a night with [checkIn, checkOut), described. */
async function firstClash(unitId: string, checkIn: Date, checkOut: Date): Promise<string | null> {
  const locale = await getLocale();
  const SOURCE_NAMES: Record<string, string> = {
    airbnb: "Airbnb",
    booking: "Booking.com",
    direct: t(locale, "source_direct"),
    manual: t(locale, "source_manual"),
  };
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const booking = await prisma.booking.findFirst({
    where: {
      unitId,
      status: { not: "cancelled" },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    orderBy: { checkIn: "asc" },
  });
  if (booking) {
    return `${SOURCE_NAMES[booking.source] ?? booking.source} ${day(booking.checkIn)} → ${day(booking.checkOut)}${
      booking.guestName ? ` (${booking.guestName})` : ""
    }`;
  }
  const lease = await prisma.lease.findFirst({
    where: { unitId, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
    orderBy: { startDate: "asc" },
  });
  if (lease) {
    return `${t(locale, "overlap_src_lease")} ${day(lease.startDate)} → ${day(lease.endDate)}${
      lease.tenantName ? ` (${lease.tenantName})` : ""
    }`;
  }
  return null;
}

export async function syncNow() {
  const operator = await requireOperator();
  await syncAllUnits(undefined, operator.id);
  revalidatePath("/units");
  revalidatePath("/");
}
