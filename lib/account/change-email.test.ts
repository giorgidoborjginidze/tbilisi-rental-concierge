import { beforeEach, describe, expect, it, vi } from "vitest";

// A new sign-in email is the new reset channel: like a new password, it
// must sign every other device out, so a stolen session does not outlive it.

const spies = vi.hoisted(() => ({ destroyOtherSessions: vi.fn(async () => 0) }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/auth/verify", () => ({ sendVerificationLink: async () => true }));
vi.mock("@/lib/files/store", () => ({ fileStore: () => null }));
vi.mock("@/lib/auth/password", () => ({
  MIN_PASSWORD_LENGTH: 8,
  hashPassword: async () => "hash",
  verifyPassword: async () => true,
}));
vi.mock("@/lib/auth/session", () => ({
  requirePerson: async () => ({ id: "ws1", userId: "u1", email: "old@example.ge", locale: "ka", role: "owner", isDemo: false }),
  requireWriter: async () => ({ id: "ws1", userId: "u1" }),
  destroySession: async () => {},
  destroyOtherSessions: spies.destroyOtherSessions,
}));
vi.mock("@/lib/db", () => {
  const prisma = {
    authAttempt: { count: async () => 0, create: async () => ({}), deleteMany: async () => ({ count: 0 }) },
    operator: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        where.id ? { passwordHash: "hash" } : null,
      update: async () => ({}),
    },
    passwordReset: { updateMany: async () => ({ count: 0 }) },
    $transaction: async (ops: unknown[]) => ops,
  };
  return { prisma };
});

import { changeEmail } from "./actions";

describe("changeEmail", () => {
  beforeEach(() => spies.destroyOtherSessions.mockClear());

  it("signs every other device out", async () => {
    const form = new FormData();
    form.set("email", "new@example.ge");
    form.set("password", "correct-password");
    expect(await changeEmail(null, form)).toEqual({ ok: true });
    expect(spies.destroyOtherSessions).toHaveBeenCalledWith("u1");
  });
});
