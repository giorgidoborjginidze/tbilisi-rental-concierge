"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { planById, plansFor, type AccountType } from "./plans";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

// Payments arrive in a later stage; until then choosing a plan
// activates it immediately (still fully limit-enforced).
export async function choosePlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  if (operator.companyId) return { error: "error_owner_only" };

  const plan = planById(str(formData, "plan"));
  if (!plan || plan.kind !== (operator.accountType as AccountType)) {
    return { error: "error_required" };
  }

  await prisma.operator.update({
    where: { id: operator.id },
    data: { plan: plan.id, planSetAt: new Date() },
  });
  revalidatePath("/billing");
  return { ok: true };
}

export async function createInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  if (operator.accountType !== "business" || operator.companyId) {
    return { error: "error_owner_only" };
  }

  const email = str(formData, "email").toLowerCase();
  if (!email || !email.includes("@")) return { error: "error_required" };

  // Seat check: owner + members + open invites must stay within the plan.
  const { getBillingContext } = await import("./context");
  const context = await getBillingContext(operator);
  const openInvites = await prisma.invite.count({
    where: { companyId: operator.id, usedAt: null },
  });
  if (context.memberCount + openInvites >= context.plan.maxMembers) {
    return { error: "error_limit_members" };
  }

  await prisma.invite.create({
    data: {
      companyId: operator.id,
      email,
      token: randomBytes(18).toString("hex"),
    },
  });
  revalidatePath("/billing");
  return { ok: true };
}

export async function revokeInvite(formData: FormData) {
  const operator = await requireOperator();
  await prisma.invite.deleteMany({
    where: { id: str(formData, "inviteId"), companyId: operator.id, usedAt: null },
  });
  revalidatePath("/billing");
}

// Detaches the member from the company; their records stay their own.
export async function removeMember(formData: FormData) {
  const operator = await requireOperator();
  await prisma.operator.updateMany({
    where: { id: str(formData, "memberId"), companyId: operator.id },
    data: { companyId: null, accountType: "personal", role: "owner" },
  });
  revalidatePath("/billing");
}
