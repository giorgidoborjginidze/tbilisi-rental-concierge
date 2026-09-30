// Pure transformation from parsed iCal events to Booking rows — no I/O.

import type { IcalEvent } from "./parse";
import type { BookingSource } from "@/lib/types";

export interface BookingCandidate {
  source: BookingSource;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  status: string;
  externalId: string;
}

export function sourceFromUrl(url: string): BookingSource {
  const lower = url.toLowerCase();
  if (lower.includes("airbnb.")) return "airbnb";
  if (lower.includes("booking.")) return "booking";
  return "direct";
}

/**
 * The demo workspace's placeholder feeds (prisma/seed.ts): they look like
 * channel links but lead nowhere. They are never fetched, and the page says
 * they are demo links instead of showing a sync error.
 */
export function isDemoFeedUrl(url: string): boolean {
  return (
    /^https:\/\/www\.airbnb\.com\/calendar\/ical\/\d+\.ics\?s=demo$/.test(url) ||
    /^https:\/\/ical\.booking\.com\/v1\/export\?t=[\w-]+-demo$/.test(url)
  );
}

/**
 * Is this event the owner's own availability block rather than a stay?
 *
 * Only Airbnb tells the two apart: a reservation is "Reserved", and the
 * nights the owner blocked (or that a calendar imported INTO Airbnb blocks —
 * those stays arrive through their own feed anyway) are "Airbnb (Not
 * available)". Booking.com exports every sold night as "CLOSED - Not
 * available" and does not tell a reservation from a closed date, so every
 * Booking.com event is treated as occupied — skipping them would hide every
 * Booking.com guest. Other feeds (a PMS, VRBO…) are treated as occupied
 * too: a missed stay is a double booking, an extra block is only a night
 * not for sale.
 */
export function isOwnerBlock(event: IcalEvent, source: BookingSource): boolean {
  if (/^airbnb \(not available\)$/i.test(event.summary.trim())) return true;
  return source === "airbnb" && /not available|blocked/i.test(event.summary);
}

const dayStamp = (date: Date) =>
  date.toISOString().slice(0, 10).replace(/-/g, "");

/** The calendar day of a DATE or DATE-TIME value, at UTC midnight. */
const calendarDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export function eventsToBookings(
  events: IcalEvent[],
  source: BookingSource,
): BookingCandidate[] {
  const candidates: BookingCandidate[] = [];
  for (const event of events) {
    if (isOwnerBlock(event, source)) continue;

    // Stays are nights: a 14:00 check-in and a 10:00 check-out are the
    // days themselves, so a stay ending on the 5th never "overlaps" one
    // starting on the 5th.
    const checkIn = calendarDay(event.start);
    const checkOut = calendarDay(event.end);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
    if (nights <= 0) continue;

    candidates.push({
      source,
      checkIn,
      checkOut,
      nights,
      status:
        event.status === "CANCELLED"
          ? "cancelled"
          : event.status === "TENTATIVE"
            ? "tentative"
            : "confirmed",
      // Feeds without UIDs still need a stable dedupe key: fall back to the
      // stay window, which is what identifies the reservation to a channel.
      externalId:
        event.uid ?? `${source}-${dayStamp(event.start)}-${dayStamp(event.end)}`,
    });
  }
  return candidates;
}
