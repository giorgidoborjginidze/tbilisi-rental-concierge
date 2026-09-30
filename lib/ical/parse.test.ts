import { describe, expect, it } from "vitest";
import { parseIcal, parseIcalDate, unfoldLines } from "./parse";
import { eventsToBookings, isDemoFeedUrl, isOwnerBlock, sourceFromUrl } from "./sync";

// Shaped like a real Airbnb export: all-day DATE values, a reservation
// ("Reserved", with the reservation URL in DESCRIPTION) and an
// "Airbnb (Not available)" block the owner created by hand.
const AIRBNB_FEED = [
  "BEGIN:VCALENDAR",
  "PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260814",
  "DTSTART;VALUE=DATE:20260810",
  "UID:1418fb93a086-8b95af8a7e5f1a2d8f3e0c4b5a6d7e8f@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDE123\\nPhone Number (L",
  " ast 4 Digits): 1234",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260822",
  "DTSTART;VALUE=DATE:20260820",
  "UID:7f3a9b2c1d4e-5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

// Shaped like a real Booking.com export: every sold night is
// "CLOSED - Not available" — Booking.com does not tell a reservation from
// a closed date — plus a folded summary and an explicit cancellation.
const BOOKING_FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//admin.booking.com//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260901",
  "DTEND;VALUE=DATE:20260905",
  "UID:6f3c8c1a2b9e4d7f8e0a1b2c3d4e5f60@booking.com",
  "DTSTAMP:20260815T101500Z",
  "SUMMARY:CLOSED - Not available",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20260906T140000Z",
  "DTEND:20260908T100000Z",
  "STATUS:CONFIRMED",
  // Folded line: continuation starts with a single space.
  "SUMMARY:CLOSED - Not available for a very very very long reservation na",
  " me that got folded",
  "UID:res-777001@booking.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260910",
  "DTEND;VALUE=DATE:20260912",
  "STATUS:CANCELLED",
  "SUMMARY:CLOSED - Not available",
  "UID:res-777002@booking.com",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("unfoldLines", () => {
  it("joins folded continuation lines", () => {
    const lines = unfoldLines("SUMMARY:Hello\r\n  wor\r\n\tld\r\nUID:x");
    expect(lines).toEqual(["SUMMARY:Hello world", "UID:x"]);
  });
});

describe("parseIcalDate", () => {
  it("parses all-day DATE values as UTC midnight", () => {
    expect(parseIcalDate("20260810")?.toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
  });

  it("parses DATE-TIME values with and without Z", () => {
    expect(parseIcalDate("20260901T140000Z")?.toISOString()).toBe(
      "2026-09-01T14:00:00.000Z",
    );
    expect(parseIcalDate("20260901T140000")?.toISOString()).toBe(
      "2026-09-01T14:00:00.000Z",
    );
  });

  it("rejects garbage", () => {
    expect(parseIcalDate("tomorrow")).toBeNull();
    expect(parseIcalDate("2026-08-10")).toBeNull();
  });
});

describe("parseIcal", () => {
  it("extracts events with uid, dates, summary from an Airbnb-style feed", () => {
    const events = parseIcal(AIRBNB_FEED);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: "1418fb93a086-8b95af8a7e5f1a2d8f3e0c4b5a6d7e8f@airbnb.com",
      summary: "Reserved",
    });
    expect(events[0].start.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(events[0].end.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });

  it("handles folded summaries and STATUS", () => {
    const events = parseIcal(BOOKING_FEED);
    expect(events).toHaveLength(3);
    expect(events[1].summary).toContain("reservation name that got folded");
    expect(events[2].status).toBe("CANCELLED");
  });

  it("ignores events without dates", () => {
    const broken = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-dates@example.com",
      "SUMMARY:Nothing",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseIcal(broken)).toHaveLength(0);
  });
});

describe("eventsToBookings", () => {
  it("maps reservations and skips availability blocks", () => {
    const bookings = eventsToBookings(parseIcal(AIRBNB_FEED), "airbnb");
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      source: "airbnb",
      nights: 4,
      status: "confirmed",
      externalId: "1418fb93a086-8b95af8a7e5f1a2d8f3e0c4b5a6d7e8f@airbnb.com",
    });
  });

  it("keeps every Booking.com 'CLOSED - Not available' event as a stay", () => {
    const bookings = eventsToBookings(parseIcal(BOOKING_FEED), "booking");
    expect(bookings).toHaveLength(3);
    expect(bookings[0]).toMatchObject({
      source: "booking",
      nights: 4,
      status: "confirmed",
      externalId: "6f3c8c1a2b9e4d7f8e0a1b2c3d4e5f60@booking.com",
    });
    expect(bookings[2].status).toBe("cancelled");
    expect(bookings[2].nights).toBe(2);
  });

  it("counts stays in nights: check-in and check-out times snap to the day", () => {
    const [, timed] = eventsToBookings(parseIcal(BOOKING_FEED), "booking");
    // 14:00 on the 6th to 10:00 on the 8th is two nights, 6th → 8th.
    expect(timed.checkIn.toISOString()).toBe("2026-09-06T00:00:00.000Z");
    expect(timed.checkOut.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(timed.nights).toBe(2);
  });

  it("skips only Airbnb's own 'Not available' blocks", () => {
    const events = parseIcal(AIRBNB_FEED);
    expect(isOwnerBlock(events[1], "airbnb")).toBe(true);
    expect(isOwnerBlock(events[0], "airbnb")).toBe(false);
    // The Airbnb block summary is recognised even from an unknown host…
    expect(isOwnerBlock(events[1], "direct")).toBe(true);
    // …but Booking.com's "Not available" is a sold night.
    expect(isOwnerBlock(parseIcal(BOOKING_FEED)[0], "booking")).toBe(false);
    // Another channel's feed: a stay unless proven otherwise.
    expect(isOwnerBlock({ ...events[0], summary: "Blocked" }, "direct")).toBe(false);
  });

  it("synthesizes a stable externalId when the feed has no UID", () => {
    const feed = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260701",
      "DTEND;VALUE=DATE:20260703",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const [booking] = eventsToBookings(parseIcal(feed), "direct");
    expect(booking.externalId).toBe("direct-20260701-20260703");
  });

  it("drops zero and negative-night events", () => {
    const feed = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260701",
      "DTEND;VALUE=DATE:20260701",
      "SUMMARY:Reserved",
      "UID:zero@x",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(eventsToBookings(parseIcal(feed), "airbnb")).toHaveLength(0);
  });
});

describe("sourceFromUrl", () => {
  it("detects the channel from the feed host", () => {
    expect(
      sourceFromUrl("https://www.airbnb.com/calendar/ical/1234.ics?s=abc"),
    ).toBe("airbnb");
    expect(sourceFromUrl("https://ical.booking.com/v1/export?t=xyz")).toBe(
      "booking",
    );
    expect(sourceFromUrl("https://my-pms.example.com/feed.ics")).toBe("direct");
  });
});

describe("isDemoFeedUrl", () => {
  it("recognises only the demo workspace's placeholder links", () => {
    expect(isDemoFeedUrl("https://www.airbnb.com/calendar/ical/41120001.ics?s=demo")).toBe(true);
    expect(isDemoFeedUrl("https://ical.booking.com/v1/export?t=vake-park-2br-demo")).toBe(true);
    expect(isDemoFeedUrl("https://www.airbnb.com/calendar/ical/41120001.ics?s=3f9a1c")).toBe(false);
    expect(isDemoFeedUrl("https://ical.booking.com/v1/export?t=4b2e9d0c")).toBe(false);
  });
});
