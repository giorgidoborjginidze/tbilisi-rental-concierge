"use server";

// The admin's hand tools while online payment and email are switched off
// (app/admin/accounts): give an account a paid plan for some months, and
// make a one-time password link to hand over by WhatsApp or phone. Only
// for ADMIN_EMAILS (requireAdmin); every use is written to the server log.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { newResetToken } from "@/lib/auth/reset";
import { planById } from "@/lib/billing/plans";
import { siteUrl } from "@/lib/site";

export type AdminState = { error?: string; ok?: string; link?: string } | null;

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const DAY_MS = 86_400_000;
/** A link handed over by hand lives a day, not the emailed link's hour. */
const ADMIN_RESET_TTL_MS = 24 * 3_600_000;

async function accountByEmail(email: string) {
  if (!email.includes("@")) return null;
  return prisma.operator.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, isDemo: true, accountType: true, companyId: true, plan: true, paidUntil: true },
  });
}

/**
 * A paid plan for `months` months: from the end of what is already paid,
 * or from today. "none" ends it at once (the account falls back to its
 * trial or the free allowance).
 */
export async function grantPlan(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const account = await accountByEmail(str(formData, "email"));
  if (!account || account.isDemo) return { error: "admin_err_account" };
  if (account.companyId) return { error: "admin_err_member" };
  const planId = str(formData, "plan");
  if (planId === "none") {
    await prisma.operator.update({ where: { id: account.id }, data: { plan: null, paidUntil: null } });
    console.info(`[admin] ${admin.email} ended the plan of ${account.email}`);
    revalidatePath("/admin/accounts");
    return { ok: "admin_plan_ended" };
  }
  const plan = planById(planId);
  if (!plan || plan.kind !== (account.accountType === "business" ? "business" : "personal")) {
    return { error: "admin_err_plan" };
  }
  const months = Math.round(Number(str(formData, "months")));
  if (!Number.isFinite(months) || months < 1 || months > 24) return { error: "admin_err_months" };
  const now = new Date();
  const from = account.plan === plan.id && account.paidUntil && account.paidUntil > now ? account.paidUntil : now;
  const paidUntil = new Date(from.getTime() + months * 30 * DAY_MS);
  await prisma.operator.update({ where: { id: account.id }, data: { plan: plan.id, paidUntil } });
  console.info(`[admin] ${admin.email} gave ${account.email} ${plan.id} until ${paidUntil.toISOString()}`);
  revalidatePath("/admin/accounts");
  return { ok: "admin_plan_given" };
}

/** A one-time password link (24 hours) for the admin to hand over. */
export async function makeResetLink(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const account = await accountByEmail(str(formData, "email"));
  if (!account || account.isDemo) return { error: "admin_err_account" };
  const now = new Date();
  // One live link at a time.
  await prisma.passwordReset.updateMany({ where: { operatorId: account.id, usedAt: null }, data: { usedAt: now } });
  const { token, id } = newResetToken();
  await prisma.passwordReset.create({
    data: { id, operatorId: account.id, expiresAt: new Date(now.getTime() + ADMIN_RESET_TTL_MS), createdAt: now },
  });
  console.info(`[admin] ${admin.email} made a password link for ${account.email}`);
  return { ok: "admin_link_made", link: `${siteUrl()}/reset/${token}` };
}
