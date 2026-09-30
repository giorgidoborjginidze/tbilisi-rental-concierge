// Where a contract stands in time — derived from its dates, never from the
// stored status column, which was written once at creation and never
// moved: a contract entered the day before it started stayed "upcoming"
// for its whole life, and a finished one stayed "active" forever.
//
// Dates are calendar days stored as UTC midnight; `today` must be the
// Tbilisi day in the same form (lib/time.ts startOfTodayTbilisi). The end
// date is exclusive — the day the rental is over.
//
// Framework-free and pure.

export type ContractPhase = "upcoming" | "active" | "ended";

export interface ContractDates {
  startDate: Date;
  endDate: Date;
}

const DAY_MS = 86_400_000;

const dayStart = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export function contractPhase(contract: ContractDates, today: Date): ContractPhase {
  const day = dayStart(today);
  if (day < dayStart(contract.startDate)) return "upcoming";
  if (day >= dayStart(contract.endDate)) return "ended";
  return "active";
}

export const isActiveContract = (contract: ContractDates, today: Date): boolean =>
  contractPhase(contract, today) === "active";

/** The contract running today (the latest-starting one if they overlap). */
export function activeContract<T extends ContractDates>(
  contracts: T[],
  today: Date,
): T | undefined {
  return contracts
    .filter((contract) => isActiveContract(contract, today))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
}

/** The next contract still to start. */
export function upcomingContract<T extends ContractDates>(
  contracts: T[],
  today: Date,
): T | undefined {
  return contracts
    .filter((contract) => contractPhase(contract, today) === "upcoming")
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
}

/** The contract whose schedule the rental page follows. */
export function scheduleContract<T extends ContractDates>(
  contracts: T[],
  today: Date,
): T | undefined {
  return activeContract(contracts, today) ?? upcomingContract(contracts, today);
}

/** Prisma filter for contracts running on `today`. */
export function activeContractWhere(today: Date) {
  const day = dayStart(today);
  return { startDate: { lte: day }, endDate: { gt: day } };
}

/** Prisma filter for contracts that ended within the last `days` days. */
export function recentlyEndedWhere(today: Date, days: number) {
  const day = dayStart(today);
  return {
    endDate: { lte: day, gt: new Date(day.getTime() - days * DAY_MS) },
  };
}

/**
 * The asset's rental status as it stands today. A running contract means
 * rented, and so does today's "rented" daily answer of a day-let asset
 * (its nights are DayEntry rows, not contracts — `rentedToday`). A stored
 * "rented" that dates from a contract which has since ended is stale —
 * unless the owner set it by hand after that contract ended — and reads as
 * vacant. Every other stored status stands.
 */
export function assetStatusNow(
  asset: { status: string; statusSetAt?: Date | null },
  contracts: ContractDates[],
  today: Date,
  opts: { rentedToday?: boolean } = {},
): string {
  if (opts.rentedToday) return "rented";
  if (contracts.some((contract) => isActiveContract(contract, today))) return "rented";
  if (asset.status !== "rented") return asset.status;
  const ended = contracts.filter((contract) => contractPhase(contract, today) === "ended");
  if (ended.length === 0) return asset.status;
  const lastEnd = Math.max(...ended.map((contract) => contract.endDate.getTime()));
  if (asset.statusSetAt && asset.statusSetAt.getTime() >= lastEnd) return asset.status;
  return "vacant";
}

/** A contract shorter than this is a stay, not a lease. */
export const SHORT_STAY_DAYS = 28;

/**
 * The one finished contract an asset's "contract ended" alert is about.
 *
 * Only the contract that ended last counts, and only while nothing runs or
 * is booked after it — a daily-let asset whose stays are short contracts
 * would otherwise raise one "contract ended" per past stay. A short stay
 * that was paid in full needs no follow-up either (the vacancy signals
 * cover the empty days); one that still owes money does.
 */
export function endedContractToFollowUp<T extends ContractDates>(
  contracts: T[],
  today: Date,
  owes: (contract: T) => boolean,
): T | null {
  if (contracts.some((contract) => contractPhase(contract, today) !== "ended")) return null;
  const last = [...contracts].sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];
  if (!last) return null;
  const days = Math.round(
    (dayStart(last.endDate).getTime() - dayStart(last.startDate).getTime()) / DAY_MS,
  );
  if (days < SHORT_STAY_DAYS && !owes(last)) return null;
  return last;
}
