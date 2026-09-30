// Paging for the bookings list — pure.
//
// The list shows current and upcoming stays FIRST (the ones that still
// need a price or a check), then past ones, newest first. It is read as two
// ordered queries; a page is a window over their concatenation.

export const BOOKINGS_PAGE_SIZE = 100;

export interface Slice {
  skip: number;
  take: number;
}

/**
 * The rows of page `page` (0-based) when the first list has `firstCount`
 * rows: how many to skip and take from each list.
 */
export function pageSlices(
  page: number,
  firstCount: number,
  size: number = BOOKINGS_PAGE_SIZE,
): { first: Slice; second: Slice } {
  const offset = Math.max(0, Math.floor(page)) * size;
  const fromFirst = Math.max(0, Math.min(size, firstCount - offset));
  return {
    first: { skip: Math.min(offset, firstCount), take: fromFirst },
    second: { skip: Math.max(0, offset - firstCount), take: size - fromFirst },
  };
}

/** A page number from the query (0-based internally, 1-based in the URL). */
export function pageFromQuery(value: string | undefined, total: number, size = BOOKINGS_PAGE_SIZE): number {
  const asked = Number.parseInt(value ?? "", 10);
  const last = Math.max(0, Math.ceil(total / size) - 1);
  if (!Number.isFinite(asked) || asked < 1) return 0;
  return Math.min(asked - 1, last);
}

/** "YYYY-MM" → the month's [start, end) at UTC midnight, or null. */
export function monthRange(value: string | undefined): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}
