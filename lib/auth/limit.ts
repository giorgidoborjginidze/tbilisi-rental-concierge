// Rate limits for sign-in and password-reset requests, kept in the database
// (AuthAttempt) so they hold across serverless instances.
//
//   - sign-in, within 15 minutes: 5 failures for one email from one
//     address; 10 for one email from anywhere (a guessing run spread over
//     many addresses); 30 from one address across every email (a shared
//     mobile-carrier address serves many people: a few typos by others
//     must not lock everyone on it out). Past a limit every attempt is
//     refused (even the right password) until the window has passed. A
//     successful sign-in clears that email's failures (never the
//     address's).
//   - registration: 5 new accounts per address an hour.
//   - reset links: 3 requests per email and 10 per IP an hour, so nobody can
//     flood someone's inbox with reset emails.
//
// Rows hold the email, the IP and the time — no password, no token — and are
// pruned after a day. The counting functions take the client so the tests can
// pass a fake.

export type AttemptKind = "login" | "reset" | "register";

interface Rule {
  windowMs: number;
  perEmail: number;
  perIp: number;
  /** One email from one address (none: not counted separately). */
  perEmailIp?: number;
}

export const ATTEMPT_RULES: Record<AttemptKind, Rule> = {
  login: { windowMs: 15 * 60_000, perEmail: 10, perIp: 30, perEmailIp: 5 },
  reset: { windowMs: 60 * 60_000, perEmail: 3, perIp: 10 },
  register: { windowMs: 60 * 60_000, perEmail: 5, perIp: 5 },
};

/** Attempt rows older than this are deleted. */
export const ATTEMPT_RETENTION_MS = 24 * 3_600_000;

export interface AttemptCounts {
  email: number;
  /** Null when the request's address is unknown (then only the email counts). */
  ip: number | null;
  /** This email from this address (null when the address is unknown). */
  emailIp?: number | null;
}

/** Pure: is the next attempt refused? */
export function isLimited(kind: AttemptKind, counts: AttemptCounts): boolean {
  const rule = ATTEMPT_RULES[kind];
  // Without a known address, the email's own count is the only guard: it
  // uses the tighter per-address figure.
  const emailLimit = counts.ip == null && rule.perEmailIp ? rule.perEmailIp : rule.perEmail;
  return (
    counts.email >= emailLimit ||
    (counts.ip != null && counts.ip >= rule.perIp) ||
    (rule.perEmailIp != null && counts.emailIp != null && counts.emailIp >= rule.perEmailIp)
  );
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
  const [byEmail, byIp, byEmailIp] = await Promise.all([
    db.authAttempt.count({ where: { kind, email, createdAt: { gte: since } } }),
    ip ? db.authAttempt.count({ where: { kind, ip, createdAt: { gte: since } } }) : Promise.resolve(null),
    ip ? db.authAttempt.count({ where: { kind, email, ip, createdAt: { gte: since } } }) : Promise.resolve(null),
  ]);
  return { email: byEmail, ip: byIp, emailIp: byEmailIp };
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
 * The client's address as the hosting proxy reports it — only where a
 * proxy is known to set it: on Vercel the platform writes both headers (a
 * client cannot forge them); elsewhere only with TRUST_PROXY_HEADERS=1 (a
 * reverse proxy that overwrites them). Otherwise a client could send any
 * address it likes and dodge the per-address limit, so none is used and
 * the per-email limits stand alone.
 */
export function clientIpFrom(
  get: (name: string) => string | null,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (!env.VERCEL && env.TRUST_PROXY_HEADERS !== "1") return null;
  const real = get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : null;
}
