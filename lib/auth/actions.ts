"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { chosenLocale, getLocale, LOCALE_COOKIE } from "@/lib/i18n/locale";
import { signInLocale } from "@/lib/i18n/sign-in-locale";
import { t, type Locale } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";
import { inviteProblem } from "./invite";
import {
  attemptCounts,
  clearAttempts,
  clientIpFrom,
  isLimited,
  recordAttempt,
} from "./limit";
import { dummyHash, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { newResetToken, RESET_TTL_MS, resetTokenId, resetUsable, validEmail } from "./reset";
import { createSession, destroySession } from "./session";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const TRIAL_MS = 30 * 86_400_000;

async function clientIp(): Promise<string | null> {
  const store = await headers();
  return clientIpFrom((name) => store.get(name));
}

/** Prisma's unique-constraint error (a race on the same email). */
const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error != null && (error as { code?: string }).code === "P2002";

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Name is optional — collected only as a display label, never required.
  // Georgian PDP / data-minimisation stance: ask for as little as possible.
  const name = str(formData, "name") || null;
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const accountType =
    str(formData, "accountType") === "business" ? "business" : "personal";
  // Workspace profile: personal accounts are "personal"; business accounts
  // pick hotel/aparthotel, brokerage/property management or car rental
  // (default hotel).
  const requestedProfile = str(formData, "profile");
  const profile =
    accountType === "business"
      ? ["brokerage", "car_rental"].includes(requestedProfile)
        ? requestedProfile
        : "hotel"
      : "personal";
  const inviteToken = str(formData, "invite");
  // Handed back with an error so the form keeps what was typed (never the password).
  const values = { name: name ?? "", email, accountType, profile };

  if (!email) return { error: "error_required", values };
  if (!validEmail(email)) return { error: "error_email_invalid", values };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "error_password_short", values };

  const now = new Date();
  // Team invite: the new account joins the inviting company as a member
  // (the company's plan and limits apply; no own trial needed). The link
  // works only for the invited email, once, for 7 days.
  const invite = inviteToken
    ? await prisma.invite.findUnique({ where: { token: inviteToken } })
    : null;
  if (inviteToken) {
    const problem = inviteProblem(invite, email, now);
    if (problem) return { error: problem, values };
  }

  // At most a few sign-ups an hour from one address (or for one email):
  // the form is no machine for minting accounts or probing which emails
  // are taken.
  const ip = await clientIp();
  if (isLimited("register", await attemptCounts(prisma, "register", email, ip, now))) {
    return { error: "error_too_many_attempts", values };
  }
  await recordAttempt(prisma, "register", email, ip, now);

  // Hash first: a taken email is refused only after the same work as a
  // free one, and with a message that does not say which it was.
  const passwordHash = await hashPassword(password);
  const existing = await prisma.operator.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "error_email_taken", values };

  // Claim the invite before using it, so one link never seats two people.
  if (invite) {
    const claimed = await prisma.invite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return { error: "error_invite_invalid", values };
  }

  // Invited members inherit the company's workspace profile.
  const company = invite
    ? await prisma.operator.findUnique({
        where: { id: invite.companyId },
        select: { profile: true },
      })
    : null;

  // The language the owner signed up in is the account's language: the
  // app's and the one their tenants' and drivers' messages are written in.
  const locale = await getLocale();

  let operatorId: string;
  try {
    const operator = await prisma.operator.create({
      data: invite
        ? {
            name,
            email,
            passwordHash,
            locale,
            localeSetAt: now,
            accountType: "business",
            profile: company?.profile ?? "hotel",
            role: invite.role === "viewer" ? "viewer" : "member",
            companyId: invite.companyId,
          }
        : {
            name,
            email,
            passwordHash,
            locale,
            localeSetAt: now,
            accountType,
            profile,
            trialEndsAt: new Date(now.getTime() + TRIAL_MS),
          },
      select: { id: true },
    });
    operatorId = operator.id;
  } catch (error) {
    if (invite) {
      await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: null } }).catch(() => undefined);
    }
    if (isUniqueViolation(error)) return { error: "error_email_taken", values };
    throw error;
  }
  await createSession(operatorId);
  redirect("/");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: "error_required", values };

  const now = new Date();
  const ip = await clientIp();
  const operator = await prisma.operator.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isDemo: true, locale: true, localeSetAt: true },
  });

  // 5 failures per email and per address in 15 minutes, then a pause. The
  // demo's password is public, so its email is not counted (a visitor's
  // typos must not lock every other visitor out); the address still is.
  const counts = await attemptCounts(prisma, "login", email, ip, now);
  if (isLimited("login", operator?.isDemo ? { ...counts, email: 0 } : counts)) {
    return { error: "error_too_many_attempts", values };
  }

  // Always one scrypt: an unknown email is checked against a dummy hash,
  // so it takes as long to refuse as a wrong password.
  const ok = await verifyPassword(password, operator?.passwordHash ?? (await dummyHash()));
  if (!operator?.passwordHash || !ok) {
    await recordAttempt(prisma, "login", email, ip, now);
    return { error: "error_invalid_credentials", values };
  }

  await clearAttempts(prisma, "login", email);
  await createSession(operator.id);
  await syncLocaleAtSignIn(operator, now);
  redirect("/");
}

/**
 * One language per owner across devices. The account's language (also its
 * tenants' and drivers' messages) changes only with the language switch
 * while signed in; the device's cookie is taken only for an account that
 * never had one chosen (lib/i18n/sign-in-locale.ts). The shared demo keeps
 * its own.
 */
async function syncLocaleAtSignIn(
  operator: { id: string; isDemo: boolean; locale: string; localeSetAt: Date | null },
  now: Date,
): Promise<void> {
  const plan = signInLocale(operator, await chosenLocale());
  if (plan.save) {
    // Marks the language as chosen (scripts/backfill-locale.ts never
    // touches a chosen one).
    await prisma.operator.update({
      where: { id: operator.id },
      data: { locale: plan.save, localeSetAt: now },
    });
  }
  if (plan.cookie) {
    const store = await cookies();
    store.set(LOCALE_COOKIE, plan.cookie, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
}

/** Sign out; the demo ribbon's "register free" continues to /register. */
export async function logout(formData?: FormData) {
  await destroySession();
  redirect(formData?.get("next") === "/register" ? "/register" : "/login");
}

/**
 * "Forgot password": always the same answer, whether or not the email has
 * an account — the link (if any) is created and sent after the response,
 * so the response time says nothing either. 3 requests per email and 10 per
 * address an hour. The demo account never gets a link.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const values = { email };
  if (!validEmail(email)) return { error: "error_email_invalid", values };
  if (!emailConfigured()) return { error: "forgot_unavailable", values };

  const now = new Date();
  const ip = await clientIp();
  if (isLimited("reset", await attemptCounts(prisma, "reset", email, ip, now))) {
    return { error: "error_too_many_resets", values };
  }
  await recordAttempt(prisma, "reset", email, ip, now);

  const locale = await getLocale();
  after(async () => {
    try {
      await sendResetLink(email, locale, now);
    } catch (error) {
      // No address, no token in the log.
      console.error(`[auth] reset link failed: ${error instanceof Error ? error.name : "error"}`);
    }
  });
  return { ok: true };
}

async function sendResetLink(email: string, locale: Locale, now: Date): Promise<void> {
  const operator = await prisma.operator.findUnique({
    where: { email },
    select: { id: true, isDemo: true },
  });
  if (!operator || operator.isDemo) return;

  // One live link at a time: a new request retires the older ones.
  await prisma.passwordReset.updateMany({
    where: { operatorId: operator.id, usedAt: null },
    data: { usedAt: now },
  });
  const { token, id } = newResetToken();
  await prisma.passwordReset.create({
    data: { id, operatorId: operator.id, expiresAt: new Date(now.getTime() + RESET_TTL_MS), createdAt: now },
  });

  const link = `${siteUrl()}/reset/${token}`;
  const body = t(locale, "email_reset_body");
  const sent = await sendEmail({
    to: email,
    subject: t(locale, "email_reset_subject"),
    text: body.replace("{link}", link),
    html: `<p>${escapeHtml(body).replace("{link}", `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`)}</p>`,
  });
  // Not delivered: the link must not linger unused in the database.
  if (!sent) await prisma.passwordReset.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Sets a new password from a reset link: the link is claimed (single use),
 * every session of the account is ended, and this browser is signed in.
 */
export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = str(formData, "token");
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "error_password_short" };
  if (password !== repeat) return { error: "error_password_mismatch" };

  const now = new Date();
  const row = token
    ? await prisma.passwordReset.findUnique({
        where: { id: resetTokenId(token) },
        include: { operator: { select: { id: true, email: true, isDemo: true } } },
      })
    : null;
  if (!resetUsable(row, now) || row.operator.isDemo) return { error: "reset_invalid" };

  const passwordHash = await hashPassword(password);
  const claimed = await prisma.passwordReset.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return { error: "reset_invalid" };

  const operatorId = row.operator.id;
  await prisma.$transaction([
    prisma.operator.update({ where: { id: operatorId }, data: { passwordHash } }),
    // Whoever knew the old password is signed out everywhere.
    prisma.session.deleteMany({ where: { operatorId } }),
    prisma.passwordReset.updateMany({ where: { operatorId, usedAt: null }, data: { usedAt: now } }),
    prisma.authAttempt.deleteMany({ where: { kind: "login", email: row.operator.email } }),
  ]);
  await createSession(operatorId);
  redirect("/");
}
