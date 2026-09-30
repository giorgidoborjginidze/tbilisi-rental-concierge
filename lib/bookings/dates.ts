// A stay's dates from a form: two calendar days (YYYY-MM-DD), check-out
// after check-in. Pure — shared by the booking actions and their tests.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function calendarDay(raw: string): Date | null {
  const match = DAY.exec(raw.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // 2026-02-31 is not a day.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/** Longest stay a form accepts — a typo in the year must not book a decade. */
export const MAX_STAY_NIGHTS = 366;

export function parseStayDates(
  checkInRaw: string,
  checkOutRaw: string,
): { checkIn: Date; checkOut: Date; nights: number } | null {
  const checkIn = calendarDay(checkInRaw);
  const checkOut = calendarDay(checkOutRaw);
  if (!checkIn || !checkOut) return null;
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
  if (nights <= 0 || nights > MAX_STAY_NIGHTS) return null;
  return { checkIn, checkOut, nights };
}
