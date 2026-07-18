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

// Channel calendars mix real reservations with availability blocks the
// operator created; blocks are not bookings and must not count as revenue
// or occupancy.
const BLOCK_PATTERN = /not available|unavailable|blocked|closed/i;

const dayStamp = (date: Date) =>
  date.toISOString().slice(0, 10).replace(/-/g, "");

export function eventsToBookings(
  events: IcalEvent[],
  source: BookingSource,
): BookingCandidate[] {
  const candidates: BookingCandidate[] = [];
  for (const event of events) {
    if (BLOCK_PATTERN.test(event.summary)) continue;

    const nights = Math.round(
      (event.end.getTime() - event.start.getTime()) / 86_400_000,
    );
    if (nights <= 0) continue;

    candidates.push({
      source,
      checkIn: event.start,
      checkOut: event.end,
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
