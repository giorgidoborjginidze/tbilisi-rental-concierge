// Local time for Georgia.
//
// The app stores calendar days as UTC midnight: a lease from 1 March is
// 2026-03-01T00:00Z, a day entry for 30 September is 2026-09-30T00:00Z.
// "Today", though, is Tbilisi's today. Between 00:00 and 04:00 local time
// the UTC date is still yesterday, so every "today" in the app goes
// through here. Asia/Tbilisi is UTC+4 all year (no daylight saving since
// 2005); Intl does the conversion, so a future change would still be
// handled.
//
// Framework-free and safe on the client: only Intl, no Node APIs.

export const TIME_ZONE = "Asia/Tbilisi";

const DAY_MS = 86_400_000;

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

/** "YYYY-MM-DD" of the Tbilisi calendar day `now` falls on. */
export function todayKey(now: Date = new Date()): string {
  const parts = keyFormatter.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The stored form of a calendar day: UTC midnight of "YYYY-MM-DD". */
export function dayFromKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** "YYYY-MM-DD" of a stored calendar day (a UTC-midnight date). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Today in Tbilisi, in the stored form (UTC midnight of the local date),
 * so it compares directly with contract, booking and day-entry dates.
 */
export function startOfTodayTbilisi(now: Date = new Date()): Date {
  return dayFromKey(todayKey(now));
}

/** Tomorrow in Tbilisi, in the stored form. */
export function startOfTomorrowTbilisi(now: Date = new Date()): Date {
  return new Date(startOfTodayTbilisi(now).getTime() + DAY_MS);
}

/** First day of the Tbilisi month `offset` months from now (stored form). */
export function monthStartTbilisi(offset = 0, now: Date = new Date()): Date {
  const today = startOfTodayTbilisi(now);
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
}

/** "YYYY-MM" of the current Tbilisi month. */
export function monthKeyTbilisi(now: Date = new Date()): string {
  return todayKey(now).slice(0, 7);
}

/** Hour of the day (0–23) in Tbilisi. */
export function hourTbilisi(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

/** Same Tbilisi calendar day? */
export function sameTbilisiDay(a: Date, b: Date): boolean {
  return todayKey(a) === todayKey(b);
}

export const intlLocale = (locale: string): string =>
  locale === "ka" ? "ka-GE" : "en-GB";

/**
 * A date/time formatter pinned to Tbilisi. Timestamps (a GPS ping, a sent
 * message) show local wall-clock time rather than the server's UTC, and
 * stored calendar days (UTC midnight) land on the same date at 04:00.
 */
export function tbilisiFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    ...options,
  });
}
