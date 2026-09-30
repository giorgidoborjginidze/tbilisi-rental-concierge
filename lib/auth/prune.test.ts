import { describe, expect, it } from "vitest";
import { ATTEMPT_RETENTION_MS } from "./limit";
import { pruneAuthRecords, pruneFilters, type PruneStore } from "./prune";

type Row = Record<string, Date | string | null>;

/** Reads the filter shapes prune.ts uses: { field: { lt } }, { field: { not: null } }, { OR: [...] }. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Record<string, unknown>[]).some((part) => matches(row, part));
    const value = row[key];
    const { lt, not } = condition as { lt?: Date; not?: null };
    if (lt !== undefined && !(value instanceof Date && value < lt)) return false;
    if (not === null && value == null) return false;
    return true;
  });
}

function table(rows: Row[]) {
  const t = {
    rows,
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const before = t.rows.length;
      t.rows = t.rows.filter((row) => !matches(row, where));
      return { count: before - t.rows.length };
    },
  };
  return t;
}

const now = new Date("2026-09-30T04:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("daily pruning of sign-in records", () => {
  it("deletes expired sessions, day-old attempts and used or expired reset links — and nothing else", async () => {
    const session = table([
      { id: "live", expiresAt: hoursAhead(5) },
      { id: "expired", expiresAt: hoursAgo(1) },
      { id: "long-gone", expiresAt: hoursAgo(24 * 90) },
    ]);
    const authAttempt = table([
      { id: "fresh", createdAt: hoursAgo(2) },
      { id: "just-inside", createdAt: new Date(now.getTime() - ATTEMPT_RETENTION_MS + 1) },
      { id: "day-old", createdAt: hoursAgo(25) },
    ]);
    const passwordReset = table([
      { id: "open", expiresAt: hoursAhead(1), usedAt: null },
      { id: "used", expiresAt: hoursAhead(1), usedAt: hoursAgo(0.1) },
      { id: "expired", expiresAt: hoursAgo(3), usedAt: null },
    ]);
    const db: PruneStore = { session, authAttempt, passwordReset };

    expect(await pruneAuthRecords(db, now)).toEqual({ sessions: 2, attempts: 1, resets: 2 });
    expect(session.rows.map((r) => r.id)).toEqual(["live"]);
    expect(authAttempt.rows.map((r) => r.id)).toEqual(["fresh", "just-inside"]);
    expect(passwordReset.rows.map((r) => r.id)).toEqual(["open"]);

    // A second run the same day finds nothing more.
    expect(await pruneAuthRecords(db, now)).toEqual({ sessions: 0, attempts: 0, resets: 0 });
  });

  it("keeps attempts for exactly the retention the Privacy Policy states (a day)", () => {
    expect(ATTEMPT_RETENTION_MS).toBe(24 * 3_600_000);
    expect(pruneFilters(now).authAttempt).toEqual({ createdAt: { lt: hoursAgo(24) } });
    expect(pruneFilters(now).session).toEqual({ expiresAt: { lt: now } });
  });
});
