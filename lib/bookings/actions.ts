"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { refreshUnitMirrors, summarizeSync, syncAllUnits } from "@/lib/ical/run-sync";
import { LIVE_STAY } from "./live";
import { tbilisiFormat } from "@/lib/time";
import type { FormState } from "@/lib/units/actions";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { submittedValues } from "@/lib/forms";
import { parseStayDates } from "./dates";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

/** The amount field: empty is "no price", anything else a sum ≥ 0. */
function parseAmount(raw: string): { amount: number | null } | { error: true } {
  if (!raw) return { amount: null };
  const amount = Number(raw.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return { error: true };
  return { amount: Math.round(amount * 100) / 100 };
}

/** Where to go after saving: only our own bookings list or calendar. */
function safeBack(back: string): string {
  return /^\/(bookings|calendar)(\?[\w=&%-]*)?$/.test(back) ? back : "/bookings";
}

const refresh = () => {
  for (const path of ["/units", "/bookings", "/calendar", "/analytics", "/"]) revalidatePath(path);
};

export async function createBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = submittedValues(formData);
  const unitId = str(formData, "unitId");
  const source = str(formData, "source") === "direct" ? "direct" : "manual";
  const guestName = str(formData, "guestName") || null;

  if (!unitId || !str(formData, "checkIn") || !str(formData, "checkOut")) {
    return { error: "error_required", values };
  }

  const operator = await requireWriter();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, operatorId: operator.id },
  });
  if (!unit) return { error: "error_required", values };

  const dates = parseStayDates(str(formData, "checkIn"), str(formData, "checkOut"));
  if (!dates) return { error: "error_dates", values };

  const parsed = parseAmount(str(formData, "amount"));
  if ("error" in parsed) return { error: "error_invalid_number", values };

  // A direct booking must never land on nights already sold on a channel
  // or let on a lease: that is the double booking the owner pays for.
  const clash = await firstClash(unitId, dates.checkIn, dates.checkOut);
  if (clash) return { error: "error_booking_overlap", detail: clash, values };

  await prisma.booking.create({
    data: {
      unitId,
      source,
      guestName,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      nights: dates.nights,
      amount: parsed.amount,
      currency: unit.currency,
      status: "confirmed",
    },
  });

  refresh();
  // Straight to the unit's calendar, where the new stay now shows.
  redirect(`/calendar?unit=${unitId}&month=${dates.checkIn.toISOString().slice(0, 7)}`);
}

/**
 * Edit a booking: its price and guest name always; its dates only when it
 * was entered by hand (an imported stay's dates follow its channel feed).
 */
export async function updateBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = submittedValues(formData);
  const operator = await requireWriter();
  const booking = await prisma.booking.findFirst({
    where: { id: str(formData, "bookingId"), unit: { operatorId: operator.id } },
  });
  if (!booking) return { error: "error_required", values };

  const parsed = parseAmount(str(formData, "amount"));
  if ("error" in parsed) return { error: "error_invalid_number", values };
  const guestName = str(formData, "guestName") || null;

  const data: {
    amount: number | null;
    guestName: string | null;
    checkIn?: Date;
    checkOut?: Date;
    nights?: number;
    mirrorOf?: null;
  } = { amount: parsed.amount, guestName };
  // A price or a guest name makes a copied block a stay in its own right.
  if (booking.mirrorOf && (parsed.amount != null || guestName)) data.mirrorOf = null;

  const imported = booking.externalId != null;
  if (!imported) {
    const dates = parseStayDates(str(formData, "checkIn"), str(formData, "checkOut"));
    if (!dates) return { error: "error_dates", values };
    const moved =
      dates.checkIn.getTime() !== booking.checkIn.getTime() ||
      dates.checkOut.getTime() !== booking.checkOut.getTime();
    // New nights must be free (the booking's own old nights do not count).
    if (moved && booking.status !== "cancelled") {
      const clash = await firstClash(booking.unitId, dates.checkIn, dates.checkOut, booking.id);
      if (clash) return { error: "error_booking_overlap", detail: clash, values };
    }
    Object.assign(data, dates);
  }

  await prisma.booking.update({ where: { id: booking.id }, data });
  refresh();
  redirect(safeBack(str(formData, "back")));
}

/** Cancel a booking (imported ones too — a feed never revives it). */
export async function cancelBooking(formData: FormData) {
  const operator = await requireWriter();
  const booking = await prisma.booking.findFirst({
    where: { id: str(formData, "bookingId"), unit: { operatorId: operator.id } },
  });
  if (!booking) return;
  if (booking.status !== "cancelled") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: "owner" },
    });
    // A Booking.com copy of this stay now stands on its own.
    await refreshUnitMirrors(booking.unitId);
  }
  refresh();
  redirect("/bookings");
}

/**
 * Undo a cancellation — only while its nights are still free, so a
 * restore can never create a double booking.
 */
export async function restoreBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
  const booking = await prisma.booking.findFirst({
    where: { id: str(formData, "bookingId"), unit: { operatorId: operator.id } },
  });
  if (!booking) return { error: "error_required" };
  if (booking.status === "cancelled") {
    const clash = await firstClash(booking.unitId, booking.checkIn, booking.checkOut, booking.id);
    if (clash) return { error: "error_booking_overlap", detail: clash };
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "confirmed", cancelledAt: null, cancelReason: null },
    });
    await refreshUnitMirrors(booking.unitId);
  }
  refresh();
  redirect("/bookings");
}

/**
 * The first stay on the unit sharing a night with [checkIn, checkOut),
 * described for the owner: a booking, a lease, or a rental contract on the
 * asset linked to the unit (the same flat).
 */
async function firstClash(
  unitId: string,
  checkIn: Date,
  checkOut: Date,
  exceptBookingId?: string,
): Promise<string | null> {
  const locale = await getLocale();
  const SOURCE_NAMES: Record<string, string> = {
    airbnb: "Airbnb",
    booking: "Booking.com",
    direct: t(locale, "source_direct"),
    manual: t(locale, "source_manual"),
  };
  const dayFormat = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const day = (date: Date) => dayFormat.format(date);
  const booking = await prisma.booking.findFirst({
    where: {
      unitId,
      // A copy of another stay is not a stay of its own: that stay is found.
      ...LIVE_STAY,
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}),
    },
    orderBy: { checkIn: "asc" },
  });
  if (booking) {
    return `${SOURCE_NAMES[booking.source] ?? booking.source} ${day(booking.checkIn)} – ${day(booking.checkOut)}${
      booking.guestName ? ` (${booking.guestName})` : ""
    }`;
  }
  const lease = await prisma.lease.findFirst({
    where: { unitId, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
    orderBy: { startDate: "asc" },
  });
  if (lease) {
    return `${t(locale, "overlap_src_lease")} ${day(lease.startDate)} – ${day(lease.endDate)}${
      lease.tenantName ? ` (${lease.tenantName})` : ""
    }`;
  }
  const contract = await prisma.rentalContract.findFirst({
    where: { asset: { unitId }, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
    orderBy: { startDate: "asc" },
  });
  if (contract) {
    return `${t(locale, "overlap_src_contract")} ${day(contract.startDate)} – ${day(contract.endDate)}${
      contract.tenantName ? ` (${contract.tenantName})` : ""
    }`;
  }
  return null;
}

export type SyncState = ReturnType<typeof summarizeSync> | null;

/** "Sync Calendars": run every feed of this workspace and say how it went. */
export async function syncCalendars(): Promise<SyncState> {
  const operator = await requireWriter();
  const results = await syncAllUnits(undefined, operator.id);
  refresh();
  return summarizeSync(results);
}
