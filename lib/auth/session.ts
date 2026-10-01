// Cookie-backed DB sessions. The cookie holds a random token; the DB row's
// id is the token's SHA-256, so a leaked database never exposes usable
// session tokens.

import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { demoRefusalPath } from "./demo";
import { newSessionToken, SESSION_COOKIE } from "./session-token";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function createSession(operatorId: string): Promise<void> {
  const token = newSessionToken();
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

// A team member works in their company's workspace: `id` is the WORKSPACE
// (the company owner's account) that every asset, contract, booking and
// alert belongs to, so every query scoped by operator.id shows the team's
// shared data. `userId` is the PERSON signed in — their own name, email,
// password, sessions and language. For an owner the two are the same.
export type SessionOperator = {
  /** The workspace the data belongs to (the company owner for a member). */
  id: string;
  /** The person signed in. */
  userId: string;
  name: string | null;
  email: string;
  locale: string;
  accountType: string;
  profile: string; // "personal" | "hotel" | "brokerage"
  plan: string | null;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  /** The person's company (null: they own their workspace). */
  companyId: string | null;
  /** "owner" | "member" (edits everything but billing and the team) | "viewer" (read-only). */
  role: string;
  /** The shared public demo: read-only (requireWriter). */
  isDemo: boolean;
};

const OPERATOR_FIELDS = {
  id: true, name: true, email: true, locale: true,
  accountType: true, profile: true, plan: true, trialEndsAt: true,
  paidUntil: true, companyId: true, role: true, isDemo: true,
} as const;

/**
 * The signed-in operator, read once per request: the layout's nav, tab bar
 * and tour and the page itself all ask, and React's cache() hands them the
 * same lookup instead of four session queries (outside a render — in a
 * server action — it simply runs).
 */
export const getSessionOperator = cache(readSessionOperator);

async function readSessionOperator(): Promise<SessionOperator | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: {
      operator: { select: { ...OPERATOR_FIELDS, company: { select: OPERATOR_FIELDS } } },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const { company, ...person } = session.operator;
  if (!company) return { ...person, userId: person.id };
  // A member: the company's workspace, plan and demo flag; their own name,
  // email, language and role.
  return {
    ...person,
    id: company.id,
    userId: person.id,
    accountType: company.accountType,
    profile: company.profile,
    plan: company.plan,
    trialEndsAt: company.trialEndsAt,
    paidUntil: company.paidUntil,
    isDemo: company.isDemo,
  };
}

/** Changes are refused for the demo and for a team member who may only look. */
export const readOnlyOperator = (operator: Pick<SessionOperator, "isDemo" | "role">): boolean =>
  operator.isDemo || operator.role === "viewer";

// For pages/actions that need a logged-in operator; redirects otherwise.
export async function requireOperator(): Promise<SessionOperator> {
  const operator = await getSessionOperator();
  if (!operator) redirect("/login");
  return operator;
}

/**
 * For every server action that changes data: the signed-in operator, unless
 * it is the shared public demo. A demo visitor is sent back to the page they
 * were on with ?demo=readonly, where the demo ribbon says "დემოში ცვლილება
 * არ ინახება — დარეგისტრირდი უფასოდ" (app/demo-ribbon.tsx). Nothing is
 * written.
 */
export async function requireWriter(): Promise<SessionOperator> {
  const operator = await requireOperator();
  if (readOnlyOperator(operator)) {
    const store = await headers();
    redirect(demoRefusalPath(store.get("referer"), store.get("host")));
  }
  return operator;
}

/**
 * For a person's own settings (name, password, email, language, devices):
 * any signed-in person, a view-only team member included — but never the
 * shared demo, which anyone can open.
 */
export async function requirePerson(): Promise<SessionOperator> {
  const operator = await requireOperator();
  if (operator.isDemo) {
    const store = await headers();
    redirect(demoRefusalPath(store.get("referer"), store.get("host")));
  }
  return operator;
}

/**
 * The same check for actions whose caller reads a result instead of
 * following a redirect (the decide cards): null for the demo, which the
 * action turns into { error: "error_demo_readonly" }.
 */
export async function getWriter(): Promise<SessionOperator | null> {
  const operator = await requireOperator();
  return readOnlyOperator(operator) ? null : operator;
}

/** The id (token hash) of this browser's session, if signed in. */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Sign out every other device: all of the operator's sessions but this one. */
export async function destroyOtherSessions(operatorId: string): Promise<number> {
  const current = await currentSessionId();
  const { count } = await prisma.session.deleteMany({
    where: { operatorId, ...(current ? { id: { not: current } } : {}) },
  });
  return count;
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
