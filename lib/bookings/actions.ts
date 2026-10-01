"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity/log";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { requireWriter } from "@/lib/auth/session";
import { refreshUnitMirrors, summarizeSync, syncAllUnits } from "@/lib/ical/run-sync";
import { LIVE_STAY } from "./live";
import { isMirroringSource, realClashes, type Cover } from "@/lib/ical/mirror";
import { tbilisiFormat } from "@/lib/time";
import type { FormState } from "@/lib/units/actions";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { submittedValues } from "@/lib/forms";
import { parseStayDates } from "./dates";
import { overlapsWhere } from "@/lib/rentals/phase";

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
  // A Booking.com block the owner closed for this very stay is no clash.
  const clash = await firstClash(unitId, dates.checkIn, dates.checkOut, { source });
  if (clash) return { error: "error_booking_overlap", detail: clash, values };
  // Booking.com's feed cannot tell a closed date from a guest: the owner
  // says which it is before the stay is saved over it.
  if (str(formData, "confirmBlock") !== "1") {
    const block = await closedBlockUnder(unitId, dates.checkIn, dates.checkOut);
    if (block) return { error: "error_booking_closed_block", detail: block, values };
  }

  const created = await prisma.booking.create({
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
  // The Booking.com block closed for this stay is marked a copy right away.
  await refreshUnitMirrors(unitId);
  await logActivity(operator, "booking.create", {
    id: created.id,
    label: `${unit.name} · ${dates.checkIn.toISOString().slice(0, 10)}–${dates.checkOut.toISOString().slice(0, 10)}${guestName ? ` · ${guestName}` : ""}`,
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
      const clash = await firstClash(booking.unitId, dates.checkIn, dates.checkOut, {
        except: booking.id,
        source: booking.source,
      });
      if (clash) return { error: "error_booking_overlap", detail: clash, values };
      if (str(formData, "confirmBlock") !== "1") {
        const block = await closedBlockUnder(booking.unitId, dates.checkIn, dates.checkOut, booking.id);
        if (block) return { error: "error_booking_closed_block", detail: block, values };
      }
    }
    Object.assign(data, dates);
  }

  await prisma.booking.update({ where: { id: booking.id }, data });
  await logActivity(operator, "booking.update", { id: booking.id, label: guestName ?? booking.guestName });
  // New dates (or a price given to / taken from a block) change which
  // Booking.com blocks are copies.
  await refreshUnitMirrors(booking.unitId);
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
    await logActivity(operator, "booking.cancel", {
      id: booking.id,
      label: `${booking.checkIn.toISOString().slice(0, 10)}–${booking.checkOut.toISOString().slice(0, 10)}${booking.guestName ? ` · ${booking.guestName}` : ""}`,
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
    const clash = await firstClash(booking.unitId, booking.checkIn, booking.checkOut, {
      except: booking.id,
      source: booking.source,
    });
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
 * asset linked to the unit (the same flat). `source` is the channel of the
 * stay being entered: a Booking.com block that only repeats its nights
 * (closed there for this very stay) is not a clash (lib/ical/mirror.ts).
 */
/**
 * A Booking.com stay with no price and no guest under the nights a stay
 * typed by hand takes: either the nights the owner closed for this guest
 * (then it becomes its copy) or a real Booking.com guest (a double
 * booking). The iCal feed cannot tell which, so the owner is asked.
 */
async function closedBlockUnder(
  unitId: string,
  checkIn: Date,
  checkOut: Date,
  except?: string,
): Promise<string | null> {
  const block = await prisma.booking.findFirst({
    where: {
      unitId,
      ...LIVE_STAY,
      source: "booking",
      amount: null,
      OR: [{ guestName: null }, { guestName: "" }],
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(except ? { id: { not: except } } : {}),
    },
    orderBy: { checkIn: "asc" },
  });
  if (!block) return null;
  const locale = await getLocale();
  const dayFormat = tbilisiFormat(locale, { day: "numeric", month: "short" });
  return `Booking.com ${dayFormat.format(block.checkIn)} – ${dayFormat.format(block.checkOut)}`;
}

async function firstClash(
  unitId: string,
  checkIn: Date,
  checkOut: Date,
  { except, source }: { except?: string; source?: string } = {},
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
  const overlapping = await prisma.booking.findMany({
    where: {
      unitId,
      // A copy of another stay is not a stay of its own: that stay is found.
      ...LIVE_STAY,
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(except ? { id: { not: except } } : {}),
    },
    orderBy: { checkIn: "asc" },
  });
  let clashing = overlapping;
  if (source && overlapping.some((stay) => isMirroringSource(stay.source))) {
    const [others, leases] = await Promise.all([
      prisma.booking.findMany({
        where: {
          unitId,
          status: { not: "cancelled" },
          ...(except ? { id: { not: except } } : {}),
        },
        select: { source: true, checkIn: true, checkOut: true },
      }),
      prisma.lease.findMany({ where: { unitId }, select: { startDate: true, endDate: true } }),
    ]);
    const covers: Cover[] = [
      ...others.map((stay) => ({ source: stay.source, start: stay.checkIn, end: stay.checkOut })),
      ...leases.map((lease) => ({ source: "lease", start: lease.startDate, end: lease.endDate })),
    ];
    clashing = realClashes({ source, start: checkIn, end: checkOut }, overlapping, covers);
  }
  const booking = clashing[0];
  if (booking) {
    return `${SOURCE_NAMES[booking.source] ?? booking.source} ${day(booking.checkIn)} – ${day(booking.checkOut)}${
      booking.guestName ? ` (${booking.guestName})` : ""
    }`;
  }
  const lease = await prisma.lease.findFirst({
    where: { unitId, ...overlapsWhere(checkIn, checkOut) },
    orderBy: { startDate: "asc" },
  });
  if (lease) {
    return `${t(locale, "overlap_src_lease")} ${day(lease.startDate)} – ${day(lease.endDate)}${
      lease.tenantName ? ` (${lease.tenantName})` : ""
    }`;
  }
  const contract = await prisma.rentalContract.findFirst({
    where: { asset: { unitId }, ...overlapsWhere(checkIn, checkOut), ...LIVE_CONTRACT },
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
