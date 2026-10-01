"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { fileStore } from "@/lib/files/store";
import {
  attemptCounts,
  clearAttempts,
  clientIpFrom,
  isLimited,
  recordAttempt,
} from "@/lib/auth/limit";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { validEmail } from "@/lib/auth/reset";
import { destroyOtherSessions, destroySession, requirePerson, requireWriter, type SessionOperator } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";
import { WORKSPACE_PROFILES } from "@/lib/nav/model";
import { after } from "next/server";
import { sendVerificationLink } from "@/lib/auth/verify";
import { asLocale } from "@/lib/i18n/strings";

// Update the operator's display name (Company / Operator Name). Empty
// clears it (the UI then falls back to the email local-part).
export async function updateProfileName(formData: FormData) {
  const operator = await requirePerson();
  const name = String(formData.get("name") ?? "").trim();
  await prisma.operator.update({
    where: { id: operator.userId },
    data: { name: name || null },
  });
  revalidatePath("/settings");
}

/**
 * Change the workspace type chosen at sign-up: it decides which sections
 * the menu and the tab bar show and which dashboard opens — nothing is
 * deleted. Only the account owner changes it; the team's members follow.
 */
export async function updateWorkspaceProfile(formData: FormData) {
  const operator = await requireWriter();
  if (operator.companyId) return; // a member: the owner decides
  const profile = String(formData.get("profile") ?? "");
  if (!(WORKSPACE_PROFILES as readonly string[]).includes(profile)) return;
  await prisma.$transaction([
    prisma.operator.update({ where: { id: operator.id }, data: { profile } }),
    prisma.operator.updateMany({ where: { companyId: operator.id }, data: { profile } }),
  ]);
  revalidatePath("/", "layout");
  // Back on Settings with a line saying it took (the menu changes too).
  redirect("/settings?saved=profile");
}

/**
 * Checks the account's current password for a sensitive change. Wrong
 * answers count toward the same limit as sign-in (5 per 15 minutes), so a
 * borrowed or stolen session cannot be used to guess the password.
 */
async function confirmPassword(
  operator: SessionOperator,
  password: string,
): Promise<"ok" | "error_password_wrong" | "error_too_many_attempts"> {
  const now = new Date();
  const store = await headers();
  const ip = clientIpFrom((name) => store.get(name));
  if (isLimited("login", await attemptCounts(prisma, "login", operator.email, ip, now))) {
    return "error_too_many_attempts";
  }
  const row = await prisma.operator.findUnique({
    where: { id: operator.userId },
    select: { passwordHash: true },
  });
  if (!row?.passwordHash || !(await verifyPassword(password, row.passwordHash))) {
    await recordAttempt(prisma, "login", operator.email, ip, now);
    return "error_password_wrong";
  }
  await clearAttempts(prisma, "login", operator.email);
  return "ok";
}

/** New password (current one required); every other device is signed out. */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const operator = await requirePerson();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  if (!current || !next) return { error: "error_required" };
  if (next.length < MIN_PASSWORD_LENGTH) return { error: "error_password_short" };
  if (next !== repeat) return { error: "error_password_mismatch" };

  const check = await confirmPassword(operator, current);
  if (check !== "ok") return { error: check };

  const passwordHash = await hashPassword(next);
  await prisma.$transaction([
    prisma.operator.update({ where: { id: operator.userId }, data: { passwordHash } }),
    // An open reset link was made for the old password.
    prisma.passwordReset.updateMany({
      where: { operatorId: operator.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await destroyOtherSessions(operator.userId);
  revalidatePath("/settings");
  return { ok: true };
}

/** New sign-in email (password required). */
export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const operator = await requirePerson();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const values = { email };
  if (!email || !password) return { error: "error_required", values };
  if (!validEmail(email)) return { error: "error_email_invalid", values };
  if (email === operator.email) return { ok: true };

  const check = await confirmPassword(operator, password);
  if (check !== "ok") return { error: check, values };

  const taken = await prisma.operator.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { error: "error_email_unavailable", values };
  try {
    await prisma.$transaction([
      // A new address is unconfirmed until its own link is opened.
      prisma.operator.update({ where: { id: operator.userId }, data: { email, emailVerifiedAt: null } }),
      prisma.passwordReset.updateMany({
        where: { operatorId: operator.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") {
      return { error: "error_email_unavailable", values };
    }
    throw error;
  }
  after(() => sendVerificationLink(operator.userId, email, asLocale(operator.locale)).catch(() => undefined));
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Settings → "send the confirmation link again". */
export async function resendVerification(): Promise<FormState> {
  const operator = await requirePerson();
  const person = await prisma.operator.findUnique({
    where: { id: operator.userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!person || person.emailVerifiedAt) return { ok: true };
  const sent = await sendVerificationLink(operator.userId, person.email, asLocale(operator.locale));
  return sent ? { ok: true } : { error: "verify_wait" };
}

/** "Sign out other devices": every session of this account but this one. */
export async function signOutOtherDevices() {
  const operator = await requirePerson();
  await destroyOtherSessions(operator.userId);
  revalidatePath("/settings");
}

/**
 * Delete the account and everything in it — assets, units, contracts,
 * payments, messages, alerts (every table cascades from the operator).
 * Asks for the password and for the word typed out, refuses the demo, and
 * signs out. Team members of a company account are kept as accounts of
 * their own (they lose the link to the company).
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const operator = await requirePerson();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (!password) return { error: "error_required" };
  if (confirm !== "delete" && confirm !== "წაშლა") return { error: "error_delete_word" };
  const check = await confirmPassword(operator, password);
  if (check !== "ok") return { error: check };

  // An owner's team keeps their sign-ins, each with an empty workspace of
  // their own that they can work in (not read-only, with a fresh trial).
  if (!operator.companyId) {
    await prisma.operator.updateMany({
      where: { companyId: operator.userId },
      data: {
        companyId: null,
        accountType: "personal",
        role: "owner",
        trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
  }
  // A member leaving: their name no longer stands on the company's log.
  if (operator.companyId) {
    await prisma.activityLog.updateMany({ where: { actorId: operator.userId }, data: { actorName: "—" } });
  }
  // The account's stored documents and photos go now, not at the next
  // daily sweep (lib/files/sweep.ts remains the safety net).
  const store = fileStore();
  const ownFiles = !operator.companyId && store ? await store.list(`op/${operator.userId}/`).catch(() => []) : [];
  await prisma.operator.delete({ where: { id: operator.userId } });
  if (store && ownFiles.length) await store.del(ownFiles.map((file) => file.pathname)).catch(() => undefined);
  await destroySession();
  redirect("/?deleted=1");
}
