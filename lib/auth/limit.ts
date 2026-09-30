// Rate limits for sign-in and password-reset requests, kept in the database
// (AuthAttempt) so they hold across serverless instances.
//
//   - sign-in: 5 failed attempts per email, and 5 per IP address, within
//     15 minutes; then every attempt is refused (even the right password)
//     until the window has passed. A successful sign-in clears that email's
//     failures (never the IP's: signing in to one's own account must not
//     reset a guessing run against other emails from the same address).
//   - reset links: 3 requests per email and 10 per IP an hour, so nobody can
//     flood someone's inbox with reset emails.
//
// Rows hold the email, the IP and the time — no password, no token — and are
// pruned after a day. The counting functions take the client so the tests can
// pass a fake.

export type AttemptKind = "login" | "reset";

interface Rule {
  windowMs: number;
  perEmail: number;
  perIp: number;
}

export const ATTEMPT_RULES: Record<AttemptKind, Rule> = {
  login: { windowMs: 15 * 60_000, perEmail: 5, perIp: 5 },
  reset: { windowMs: 60 * 60_000, perEmail: 3, perIp: 10 },
};

/** Attempt rows older than this are deleted. */
export const ATTEMPT_RETENTION_MS = 24 * 3_600_000;

export interface AttemptCounts {
  email: number;
  /** Null when the request's address is unknown (then only the email counts). */
  ip: number | null;
}

/** Pure: is the next attempt refused? */
export function isLimited(kind: AttemptKind, counts: AttemptCounts): boolean {
  const rule = ATTEMPT_RULES[kind];
  return counts.email >= rule.perEmail || (counts.ip != null && counts.ip >= rule.perIp);
}

// The slice of the Prisma client used here.
export interface AttemptStore {
  authAttempt: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
    create(args: { data: { kind: string; email: string; ip: string | null; createdAt: Date } }): Promise<unknown>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

export async function attemptCounts(
  db: AttemptStore,
  kind: AttemptKind,
  email: string,
  ip: string | null,
  now: Date,
): Promise<AttemptCounts> {
  const since = new Date(now.getTime() - ATTEMPT_RULES[kind].windowMs);
  const [byEmail, byIp] = await Promise.all([
    db.authAttempt.count({ where: { kind, email, createdAt: { gte: since } } }),
    ip ? db.authAttempt.count({ where: { kind, ip, createdAt: { gte: since } } }) : Promise.resolve(null),
  ]);
  return { email: byEmail, ip: byIp };
}

export async function recordAttempt(
  db: AttemptStore,
  kind: AttemptKind,
  email: string,
  ip: string | null,
  now: Date,
): Promise<void> {
  await db.authAttempt.create({ data: { kind, email, ip, createdAt: now } });
  // Opportunistic pruning keeps the table small without a separate job.
  await db.authAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - ATTEMPT_RETENTION_MS) } },
  });
}

/** After a successful sign-in: forget this email's failures. */
export async function clearAttempts(db: AttemptStore, kind: AttemptKind, email: string): Promise<void> {
  await db.authAttempt.deleteMany({ where: { kind, email } });
}

/**
 * The client's address as the hosting proxy reports it. On Vercel both
 * headers are set by the platform (a client cannot forge them); elsewhere
 * the first x-forwarded-for entry is the best available guess.
 */
export function clientIpFrom(get: (name: string) => string | null): string | null {
  const real = get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}
