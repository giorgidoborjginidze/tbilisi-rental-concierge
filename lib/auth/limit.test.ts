import { describe, expect, it } from "vitest";
import {
  ATTEMPT_RETENTION_MS,
  ATTEMPT_RULES,
  attemptCounts,
  clearAttempts,
  clientIpFrom,
  isLimited,
  recordAttempt,
  type AttemptStore,
} from "./limit";

type Row = { kind: string; email: string; ip: string | null; createdAt: Date };

/** In-memory stand-in for prisma.authAttempt (only the filters limit.ts uses). */
function memoryStore(rows: Row[] = []): AttemptStore & { rows: Row[] } {
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "createdAt") {
        const range = value as { gte?: Date; lt?: Date };
        return (!range.gte || row.createdAt >= range.gte) && (!range.lt || row.createdAt < range.lt);
      }
      return (row as Record<string, unknown>)[key] === value;
    });
  const store = {
    rows,
    authAttempt: {
      count: async ({ where }: { where: Record<string, unknown> }) => store.rows.filter((r) => matches(r, where)).length,
      create: async ({ data }: { data: Row }) => {
        store.rows.push(data);
        return data;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        store.rows = store.rows.filter((r) => !matches(r, where));
        return {};
      },
    },
  };
  return store;
}

const now = new Date("2026-09-30T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("sign-in rate limit", () => {
  it("refuses the sixth try after five failures for one email from one address", async () => {
    const db = memoryStore();
    for (let i = 0; i < 5; i += 1) {
      expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", "10.0.0.1", now))).toBe(false);
      await recordAttempt(db, "login", "a@b.ge", "10.0.0.1", now);
    }
    expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", "10.0.0.1", now))).toBe(true);
    // The owner on another address can still sign in…
    expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", "10.0.0.2", now))).toBe(false);
  });

  it("…but a guessing run spread over many addresses stops at ten for the email", async () => {
    const db = memoryStore();
    for (let i = 0; i < 10; i += 1) await recordAttempt(db, "login", "a@b.ge", `10.0.0.${i}`, now);
    expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", "10.0.0.99", now))).toBe(true);
  });

  it("a few typos by others on a shared carrier address do not lock everyone out", async () => {
    const db = memoryStore();
    for (let i = 0; i < 6; i += 1) await recordAttempt(db, "login", `user${i}@b.ge`, "203.0.113.7", now);
    expect(isLimited("login", await attemptCounts(db, "login", "owner@b.ge", "203.0.113.7", now))).toBe(false);
  });

  it("refuses one address guessing across many emails", async () => {
    const db = memoryStore();
    for (let i = 0; i < ATTEMPT_RULES.login.perIp; i += 1) {
      await recordAttempt(db, "login", `user${i}@b.ge`, "203.0.113.7", now);
    }
    const counts = await attemptCounts(db, "login", "fresh@b.ge", "203.0.113.7", now);
    expect(counts.email).toBe(0);
    expect(isLimited("login", counts)).toBe(true);
  });

  it("forgets failures older than the window, and prunes rows older than a day", async () => {
    const db = memoryStore([
      ...Array.from({ length: 5 }, () => ({ kind: "login", email: "a@b.ge", ip: null, createdAt: minutesAgo(16) })),
      { kind: "login", email: "old@b.ge", ip: null, createdAt: new Date(now.getTime() - ATTEMPT_RETENTION_MS - 1) },
    ]);
    expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", null, now))).toBe(false);
    await recordAttempt(db, "login", "x@b.ge", null, now);
    expect(db.rows.some((r) => r.email === "old@b.ge")).toBe(false);
  });

  it("clears an email's failures after a successful sign-in, never another's", async () => {
    const db = memoryStore();
    await recordAttempt(db, "login", "a@b.ge", "1.1.1.1", now);
    await recordAttempt(db, "login", "victim@b.ge", "1.1.1.1", now);
    await clearAttempts(db, "login", "a@b.ge");
    expect(db.rows.map((r) => r.email)).toEqual(["victim@b.ge"]);
  });

  it("limits reset-link requests to 3 per email an hour", async () => {
    const db = memoryStore();
    for (let i = 0; i < 3; i += 1) await recordAttempt(db, "reset", "a@b.ge", null, minutesAgo(50));
    expect(isLimited("reset", await attemptCounts(db, "reset", "a@b.ge", null, now))).toBe(true);
    // Sign-in failures are counted separately.
    expect(isLimited("login", await attemptCounts(db, "login", "a@b.ge", null, now))).toBe(false);
  });
});

describe("clientIpFrom", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;
  const vercel = { VERCEL: "1" };
  it("on Vercel: the platform's x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }), vercel)).toBe("9.9.9.9");
    expect(clientIpFrom(headers({ "x-forwarded-for": " 1.1.1.1 , 10.0.0.1" }), vercel)).toBe("1.1.1.1");
    expect(clientIpFrom(headers({}), vercel)).toBeNull();
  });

  it("elsewhere the headers are the client's own word: not trusted unless a proxy is declared", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "10.77.0.5" }), {})).toBeNull();
    expect(clientIpFrom(headers({ "x-real-ip": "10.77.0.5" }), { TRUST_PROXY_HEADERS: "1" })).toBe("10.77.0.5");
  });
});
