"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { siteUrl } from "@/lib/site";
import { createFlittCheckout } from "./flitt";
import { planById, plansFor, type AccountType } from "./plans";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

// Starts a Flitt checkout for the chosen plan. A pending Payment is
// recorded, then the buyer is redirected to the hosted payment page. The
// plan is only activated later, by the provider's verified callback.
export async function startCheckout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  if (operator.companyId) return { error: "error_owner_only" };

  const plan = planById(str(formData, "plan"));
  if (!plan || plan.kind !== (operator.accountType as AccountType)) {
    return { error: "error_required" };
  }

  const orderId = `activo-${operator.id}-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const amountMinor = Math.round(plan.priceGel * 100);

  await prisma.payment.create({
    data: {
      operatorId: operator.id,
      plan: plan.id,
      amountMinor,
      status: "pending",
      orderId,
    },
  });

  let checkoutUrl: string;
  try {
    checkoutUrl = await createFlittCheckout({
      orderId,
      amountMinor,
      description: `Activo — ${plan.id} (${plan.priceGel} GEL/mo)`,
      callbackUrl: `${siteUrl()}/api/payments/flitt/callback`,
      responseUrl: `${siteUrl()}/billing?paid=1`,
    });
  } catch {
    await prisma.payment.update({
      where: { orderId },
      data: { status: "declined" },
    });
    return { error: "error_payment" };
  }

  // redirect throws — must be outside the try/catch above.
  redirect(checkoutUrl);
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
