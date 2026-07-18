// Pure iCal (RFC 5545) parsing — no framework, no I/O. Covers what Airbnb
// and Booking.com calendar exports actually emit: VEVENT blocks with
// DATE or DATE-TIME values, folded lines, and optional STATUS.

export interface IcalEvent {
  uid: string | null;
  start: Date;
  end: Date;
  summary: string;
  status: string | null; // CONFIRMED | CANCELLED | TENTATIVE
}

// RFC 5545 folds long lines; a continuation starts with a space or tab.
export function unfoldLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const raw of rawLines) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else if (raw.length > 0) {
      lines.push(raw);
    }
  }
  return lines;
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseProperty(line: string): Property | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      params[part.slice(0, eq).toUpperCase()] = part
        .slice(eq + 1)
        .replace(/^"|"$/g, "");
    }
  }
  return { name: name.toUpperCase(), params, value };
}

// "20260801" (all-day) or "20260801T140000" / "20260801T140000Z".
// Naive local times (with or without TZID) are treated as UTC — bookings
// are day-granularity, so a few hours of skew never moves the date for
// the feeds we consume.
export function parseIcalDate(value: string): Date | null {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/,
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(
    Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh ?? 0),
      Number(mm ?? 0),
      Number(ss ?? 0),
    ),
  );
}

export function parseIcal(text: string): IcalEvent[] {
  const lines = unfoldLines(text);
  const events: IcalEvent[] = [];
  let current: Partial<Record<"uid" | "summary" | "status", string>> & {
    start?: Date;
    end?: Date;
  } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.start && current?.end) {
        events.push({
          uid: current.uid ?? null,
          start: current.start,
          end: current.end,
          summary: current.summary ?? "",
          status: current.status ?? null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const prop = parseProperty(line);
    if (!prop) continue;
    switch (prop.name) {
      case "UID":
        current.uid = prop.value.trim();
        break;
      case "SUMMARY":
        current.summary = prop.value.trim();
        break;
      case "STATUS":
        current.status = prop.value.trim().toUpperCase();
        break;
      case "DTSTART":
        current.start = parseIcalDate(prop.value.trim()) ?? undefined;
        break;
      case "DTEND":
        current.end = parseIcalDate(prop.value.trim()) ?? undefined;
        break;
    }
  }
  return events;
}
