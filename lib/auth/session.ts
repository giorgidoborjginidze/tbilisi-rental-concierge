// Cookie-backed DB sessions. The cookie holds a random token; the DB row's
// id is the token's SHA-256, so a leaked database never exposes usable
// session tokens.

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function createSession(operatorId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { id: sha256(token), operatorId, expiresAt },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export type SessionOperator = {
  id: string;
  name: string;
  email: string;
  locale: string;
  accountType: string;
  plan: string | null;
  trialEndsAt: Date | null;
  companyId: string | null;
  role: string;
};

export async function getSessionOperator(): Promise<SessionOperator | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: {
      operator: {
        select: {
          id: true, name: true, email: true, locale: true,
          accountType: true, plan: true, trialEndsAt: true,
          companyId: true, role: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.operator;
}

// For pages/actions that need a logged-in operator; redirects otherwise.
export async function requireOperator(): Promise<SessionOperator> {
  const operator = await getSessionOperator();
  if (!operator) redirect("/login");
  return operator;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .delete({ where: { id: sha256(token) } })
      .catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}
