import { describe, expect, it } from "vitest";
import { parseIcal, parseIcalDate, unfoldLines } from "./parse";
import { eventsToBookings, sourceFromUrl } from "./sync";

// Shaped like a real Airbnb export: all-day DATE values, reservation UIDs,
// and an "Airbnb (Not available)" block the operator created by hand.
const AIRBNB_FEED = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTSTAMP:20260701T000000Z",
  "DTSTART;VALUE=DATE:20260810",
  "DTEND;VALUE=DATE:20260814",
  "SUMMARY:Reserved",
  "UID:1418fb93a086-8b95af8a7e5f1a@airbnb.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTAMP:20260701T000000Z",
  "DTSTART;VALUE=DATE:20260820",
  "DTEND;VALUE=DATE:20260822",
  "SUMMARY:Airbnb (Not available)",
  "UID:block-1@airbnb.com",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const BOOKING_FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//BookingCom//Calendar//EN",
  "BEGIN:VEVENT",
  "DTSTART:20260901T140000Z",
  "DTEND:20260905T100000Z",
  "STATUS:CONFIRMED",
  // Folded line: continuation starts with a single space.
  "SUMMARY:CLOSED - Booking.com reservation for a very very very long gues",
  " t name that got folded",
  "UID:res-777001@booking.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260910",
  "DTEND;VALUE=DATE:20260912",
  "STATUS:CANCELLED",
  "SUMMARY:Reservation",
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
      uid: "1418fb93a086-8b95af8a7e5f1a@airbnb.com",
      summary: "Reserved",
    });
    expect(events[0].start.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(events[0].end.toISOString()).toBe("2026-08-14T00:00:00.000Z");
  });

  it("handles folded summaries and STATUS", () => {
    const events = parseIcal(BOOKING_FEED);
    expect(events).toHaveLength(2);
    expect(events[0].summary).toContain("guest name that got folded");
    expect(events[1].status).toBe("CANCELLED");
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
      externalId: "1418fb93a086-8b95af8a7e5f1a@airbnb.com",
    });
  });

  it("skips CLOSED blocks and maps cancelled status", () => {
    const bookings = eventsToBookings(parseIcal(BOOKING_FEED), "booking");
    // First event's summary starts with "CLOSED" → treated as a block.
    expect(bookings).toHaveLength(1);
    expect(bookings[0].status).toBe("cancelled");
    expect(bookings[0].nights).toBe(2);
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
