"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  attemptCounts,
  clearAttempts,
  clientIpFrom,
  isLimited,
  recordAttempt,
} from "@/lib/auth/limit";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { validEmail } from "@/lib/auth/reset";
import { destroyOtherSessions, requireWriter, type SessionOperator } from "@/lib/auth/session";
import type { FormState } from "@/lib/units/actions";

// Update the operator's display name (Company / Operator Name). Empty
// clears it (the UI then falls back to the email local-part).
export async function updateProfileName(formData: FormData) {
  const operator = await requireWriter();
  const name = String(formData.get("name") ?? "").trim();
  await prisma.operator.update({
    where: { id: operator.id },
    data: { name: name || null },
  });
  revalidatePath("/settings");
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
    where: { id: operator.id },
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
  const operator = await requireWriter();
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
    prisma.operator.update({ where: { id: operator.id }, data: { passwordHash } }),
    // An open reset link was made for the old password.
    prisma.passwordReset.updateMany({
      where: { operatorId: operator.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await destroyOtherSessions(operator.id);
  revalidatePath("/settings");
  return { ok: true };
}

/** New sign-in email (password required). */
export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const operator = await requireWriter();
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
      prisma.operator.update({ where: { id: operator.id }, data: { email } }),
      prisma.passwordReset.updateMany({
        where: { operatorId: operator.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "P2002") {
      return { error: "error_email_unavailable", values };
    }
    throw error;
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Sign out other devices": every session of this account but this one. */
export async function signOutOtherDevices() {
  const operator = await requireWriter();
  await destroyOtherSessions(operator.id);
  revalidatePath("/settings");
}
