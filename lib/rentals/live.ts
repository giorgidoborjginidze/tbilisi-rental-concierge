// A contract the owner deleted is kept (soft delete: RentalContract.deletedAt)
// so the delete can be undone and its payment history is never lost with a
// stray tap — but nothing may read it as a contract any more: no status,
// schedule, income, alert, reminder, overlap or count. Every query of
// RentalContract rows — direct, nested (`contracts: { where: … }`), counted
// (`_count`) or as a relation filter (`contracts: { some: … }`) — carries
// this filter. lib/rentals/live.test.ts checks the source for it.

export const LIVE_CONTRACT = { deletedAt: null } as const;

/** How long a deleted contract can be brought back from the undo notice. */
export const CONTRACT_UNDO_MS = 30 * 24 * 60 * 60 * 1000;

/** The earliest deletion that can still be undone. */
export const restorableSince = (now: Date = new Date()): Date =>
  new Date(now.getTime() - CONTRACT_UNDO_MS);
