// Deletes the sign-in records the Privacy Policy says are not kept, once a
// day from the automatic run (lib/automation/run.ts):
//
//   - sessions past their expiry. readSessionOperator deletes an expired
//     row only when its browser sends the cookie again, and a browser never
//     sends an expired cookie — without this job the row stayed forever;
//   - rate-limit attempts older than ATTEMPT_RETENTION_MS (recordAttempt
//     prunes too, but only when someone makes a new attempt);
//   - password-reset links that were used or have expired (a dead link
//     reads the same as a missing one on /reset).
//
// Takes the client so the tests can pass a fake.

import { ATTEMPT_RETENTION_MS } from "./limit";

interface Deletes {
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

// The slice of the Prisma client used here.
export interface PruneStore {
  session: Deletes;
  authAttempt: Deletes;
  passwordReset: Deletes;
}

export interface PruneCounts {
  sessions: number;
  attempts: number;
  resets: number;
}

/** The three filters, for a given moment. */
export function pruneFilters(now: Date) {
  return {
    session: { expiresAt: { lt: now } },
    authAttempt: { createdAt: { lt: new Date(now.getTime() - ATTEMPT_RETENTION_MS) } },
    passwordReset: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
  };
}

export async function pruneAuthRecords(db: PruneStore, now: Date): Promise<PruneCounts> {
  const where = pruneFilters(now);
  const [sessions, attempts, resets] = await Promise.all([
    db.session.deleteMany({ where: where.session }),
    db.authAttempt.deleteMany({ where: where.authAttempt }),
    db.passwordReset.deleteMany({ where: where.passwordReset }),
  ]);
  return { sessions: sessions.count, attempts: attempts.count, resets: resets.count };
}
