import { beforeEach, describe, expect, it, vi } from "vitest";

// The sign-in limit must hold when the guesses arrive all at once: many
// parallel requests for one email may not each get a password check
// before any of them is counted.

const db = vi.hoisted(() => ({
  attempts: [] as { kind: string; email: string; ip: string | null; createdAt: Date }[],
}));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/email", () => ({ emailConfigured: () => false, escapeHtml: (s: string) => s, sendEmail: async () => {} }));
vi.mock("@/lib/i18n/locale", () => ({ chosenLocale: async () => null, getLocale: async () => "ka", LOCALE_COOKIE: "locale" }));
vi.mock("./session", () => ({ createSession: async () => {}, destroySession: async () => {} }));
vi.mock("./verify", () => ({ sendVerificationLink: async () => true }));
// A wrong password, checked as slowly as scrypt would be.
vi.mock("./password", () => ({
  MIN_PASSWORD_LENGTH: 8,
  hashPassword: async () => "hash",
  dummyHash: async () => "dummy",
  verifyPassword: async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return false;
  },
}));
const matches = (row: { kind: string; email: string; ip: string | null; createdAt: Date }, where: Record<string, unknown>) =>
  row.kind === where.kind &&
  (where.email === undefined || row.email === where.email) &&
  (where.ip === undefined || row.ip === where.ip) &&
  row.createdAt >= ((where.createdAt as { gte?: Date } | undefined)?.gte ?? new Date(0));
vi.mock("@/lib/db", () => ({
  prisma: {
    operator: {
      findUnique: async () => ({ id: "op1", passwordHash: "hash", isDemo: false, locale: "ka", localeSetAt: null }),
    },
    authAttempt: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        await tick();
        return db.attempts.filter((row) => matches(row, where)).length;
      },
      create: async ({ data }: { data: { kind: string; email: string; ip: string | null; createdAt: Date } }) => {
        await tick();
        db.attempts.push(data);
        return data;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        await tick();
        const before = db.attempts.length;
        db.attempts = db.attempts.filter((row) =>
          where.kind ? !(row.kind === where.kind && row.email === where.email) : true,
        );
        return { count: before - db.attempts.length };
      },
    },
  },
}));

import { login } from "./actions";

const attempt = () => {
  const form = new FormData();
  form.set("email", "owner@example.ge");
  form.set("password", "wrong-password");
  return login(null, form);
};

describe("login under a burst of parallel guesses", () => {
  beforeEach(() => {
    db.attempts = [];
  });

  it("checks at most five passwords for one email, however many arrive together", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, attempt));
    const checked = results.filter((r) => r?.error === "error_invalid_credentials").length;
    const refused = results.filter((r) => r?.error === "error_too_many_attempts").length;
    expect(checked).toBeLessThanOrEqual(5);
    expect(checked + refused).toBe(20);
  });

  it("still lets a lone wrong guess through to the password check", async () => {
    expect((await attempt())?.error).toBe("error_invalid_credentials");
  });
});
