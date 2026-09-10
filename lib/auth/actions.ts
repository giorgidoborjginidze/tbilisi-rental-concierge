"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { burnVerifyTime, hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, getSessionOperator } from "./session";
import { checkThrottle, clearFailures, registerFailure } from "./throttle";
import { recordAudit, requestIp } from "@/lib/audit/log";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const TRIAL_MS = 30 * 86_400_000;

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

  if (!email) return { error: "error_required" };
  if (password.length < 8) return { error: "error_password_short" };

  const existing = await prisma.operator.findUnique({ where: { email } });
  if (existing) return { error: "error_email_taken" };

  // Team invite: the new account joins the inviting company as a member
  // (the company's plan and limits apply; no own trial needed).
  const invite = inviteToken
    ? await prisma.invite.findUnique({ where: { token: inviteToken } })
    : null;
  if (inviteToken && (!invite || invite.usedAt)) {
    return { error: "error_invite_invalid" };
  }

  // Invited members inherit the company's workspace profile.
  const company = invite
    ? await prisma.operator.findUnique({
        where: { id: invite.companyId },
        select: { profile: true },
      })
    : null;

  const operator = await prisma.operator.create({
    data: invite
      ? {
          name,
          email,
          passwordHash: hashPassword(password),
          accountType: "business",
          profile: company?.profile ?? "hotel",
          role: "member",
          companyId: invite.companyId,
        }
      : {
          name,
          email,
          passwordHash: hashPassword(password),
          accountType,
          profile,
          trialEndsAt: new Date(Date.now() + TRIAL_MS),
        },
  });
  if (invite) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  }
  await recordAudit({
    action: "register",
    actorId: operator.id,
    actorEmail: email,
    entity: "Operator",
    entityId: operator.id,
    detail: { accountType, invited: invite != null },
  });
  await createSession(operator.id);
  redirect("/");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "error_required" };

  // Guessing runs are slowed per (email, source address). The account is
  // never locked itself, so nobody can shut an operator out of their own
  // dashboard by getting their password wrong on purpose.
  const ip = await requestIp();
  const throttle = await checkThrottle(email, ip);
  if (throttle.locked) {
    await recordAudit({
      action: "login_locked",
      actorEmail: email,
      ip,
      detail: { retryAfterSeconds: throttle.retryAfterSeconds },
    });
    return { error: "error_too_many_attempts" };
  }

  const operator = await prisma.operator.findUnique({ where: { email } });
  const ok =
    operator?.passwordHash != null &&
    verifyPassword(password, operator.passwordHash);

  if (!ok) {
    // Spend the same scrypt time on an unknown address as on a known one.
    if (!operator?.passwordHash) burnVerifyTime(password);
    const state = await registerFailure(email, ip);
    await recordAudit({
      action: "login_failed",
      actorId: operator?.id ?? null,
      actorEmail: email,
      ip,
      detail: { locked: state.locked },
    });
    return {
      error: state.locked ? "error_too_many_attempts" : "error_invalid_credentials",
    };
  }

  await clearFailures(email, ip);
  await recordAudit({
    action: "login",
    actorId: operator.id,
    actorEmail: email,
    ip,
    entity: "Operator",
    entityId: operator.id,
  });
  await createSession(operator.id);
  redirect("/");
}

export async function logout() {
  const operator = await getSessionOperator();
  if (operator) {
    await recordAudit({
      action: "logout",
      actorId: operator.id,
      actorEmail: operator.email,
      entity: "Operator",
      entityId: operator.id,
    });
  }
  await destroySession();
  redirect("/login");
}
