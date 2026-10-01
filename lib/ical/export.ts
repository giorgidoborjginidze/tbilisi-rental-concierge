// A unit's calendar as iCalendar (RFC 5545), for Airbnb and Booking.com to
// import: every night Activo knows is taken — bookings, long lets,
// contracts, days marked "rented" — as an all-day busy event. No guest
// names or phone numbers: the channels only need "not available".
//
// Each channel gets its own address (`for=airbnb`, `for=booking`) that
// leaves out the stays it sent itself, so a booking never comes back to the
// channel it came from as a second block. Pure — the route loads the stays.

export type ExportChannel = "airbnb" | "booking" | null;

export interface BusyStay {
  /** Stable across exports, so the channel updates rather than duplicates. */
  id: string;
  /** Where the stay came from: "airbnb", "booking", "direct", "lease", … */
  kind: string;
  start: Date;
  end: Date;
}

export function asChannel(value: string | null | undefined): ExportChannel {
  return value === "airbnb" || value === "booking" ? value : null;
}

/** The stays a channel should see: all but its own. */
export function staysFor(stays: BusyStay[], channel: ExportChannel): BusyStay[] {
  return channel ? stays.filter((stay) => stay.kind !== channel) : stays;
}

const ymd = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Text values escaped as RFC 5545 asks. */
const text = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets folded with CRLF + space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (size + length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += length;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(input: {
  name: string;
  stays: BusyStay[];
  now: Date;
  domain?: string;
}): string {
  const domain = input.domain ?? "activo.world";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Activo//Calendar export//KA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(input.name)}`,
  ];
  for (const stay of input.stays) {
    if (!(stay.end > stay.start)) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${stay.id}@${domain}`,
      `DTSTAMP:${stamp(input.now)}`,
      `DTSTART;VALUE=DATE:${ymd(stay.start)}`,
      `DTEND;VALUE=DATE:${ymd(stay.end)}`,
      "SUMMARY:Activo — not available",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
