// The numbers behind the brute-force brake, kept free of the database so
// the policy can be read — and tested — on its own.

/** Failures allowed before the (email, address) pair is put on hold. */
export const MAX_ATTEMPTS = 8;
/** How long a counting window lasts before it resets on its own. */
export const WINDOW_MS = 15 * 60_000;
/** Lock length for the first lock, doubling per extra failure. */
export const LOCK_BASE_MS = 60_000;
/** Ceiling, so a persistent attacker cannot lock a pair out for ever. */
export const LOCK_MAX_MS = 60 * 60_000;

/** Lock length for the n-th failure past the threshold. */
export function lockDuration(count: number): number {
  const over = Math.max(0, count - MAX_ATTEMPTS);
  return Math.min(LOCK_MAX_MS, LOCK_BASE_MS * 2 ** over);
}
