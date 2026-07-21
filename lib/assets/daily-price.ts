// Per-day pricing for daily rentals: base rate with weekend and holiday
// premiums. Pure math — no framework, no I/O.

/** Fixed-date Georgian public holidays as "MM-DD" (movable Orthodox
 * Easter days are not included — treat this as an editable reference). */
export const GEORGIAN_HOLIDAYS = new Set([
  "01-01", "01-02", // New Year
  "01-07", // Orthodox Christmas
  "01-19", // Epiphany
  "03-03", // Mother's Day
  "03-08", // International Women's Day
  "04-09", // Day of National Unity
  "05-09", // Victory Day
  "05-12", // Saint Andrew's Day
  "05-26", // Independence Day
  "08-28", // Mariamoba
  "10-14", // Svetitskhovloba
  "11-23", // Giorgoba
]);

export const isHoliday = (date: Date): boolean =>
  GEORGIAN_HOLIDAYS.has(
    `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
  );

export const isWeekend = (date: Date): boolean => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

export type DayKind = "holiday" | "weekend" | "base";

/** Holiday wins over weekend when both apply. */
export const dayKind = (date: Date): DayKind =>
  isHoliday(date) ? "holiday" : isWeekend(date) ? "weekend" : "base";

/** Effective price for one day; premiums are percentages (e.g. 20). */
export function dayPrice(
  date: Date,
  base: number,
  weekendPct: number,
  holidayPct: number,
): number {
  const kind = dayKind(date);
  const premium = kind === "holiday" ? holidayPct : kind === "weekend" ? weekendPct : 0;
  return Math.round(base * (1 + premium / 100));
}
