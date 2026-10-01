"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity/log";
import { requireWriter } from "@/lib/auth/session";
import { siteUrl } from "@/lib/site";
import { createFlittCheckout, flittConfig } from "./flitt";
import { planById, type AccountType } from "./plans";
import { openInviteWhere } from "@/lib/auth/invite";
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
  const operator = await requireWriter();
  if (operator.companyId) return { error: "error_owner_only" };

  const plan = planById(str(formData, "plan"));
  if (!plan || plan.kind !== (operator.accountType as AccountType)) {
    return { error: "error_required" };
  }

  // Production without merchant keys: no checkout at all (never the public
  // sandbox, whose "payments" cost nothing).
  const cfg = flittConfig();
  if (!cfg) {
    console.error("[flitt] checkout refused: FLITT_MERCHANT_ID / FLITT_SECRET_KEY are not set for this deployment");
    return { error: "error_payment_unavailable" };
  }

  const orderId = `activo-${operator.id}-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const amountMinor = Math.round(plan.priceGel * 100);

  await prisma.payment.create({
    data: {
      operatorId: operator.id,
      plan: plan.id,
      amountMinor,
      // What Flitt will actually charge (the sandbox charges USD; a
      // deployment may set FLITT_CURRENCY) — the history shows it.
      currency: cfg.currency,
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
      // The buyer comes back to this order's own status (app/billing/return).
      responseUrl: `${siteUrl()}/billing/return?order=${encodeURIComponent(orderId)}`,
    }, cfg);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // Logged for diagnosis; the user sees a friendly message.
    console.error("[flitt] checkout failed:", detail);
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
  const operator = await requireWriter();
  if (operator.accountType !== "business" || operator.companyId) {
    return { error: "error_owner_only" };
  }

  const email = str(formData, "email").toLowerCase();
  if (!email || !email.includes("@")) return { error: "error_required" };

  // Seat check: owner + members + open invites must stay within the plan.
  // An expired invite can no longer be used, so it holds no seat.
  const { getBillingContext } = await import("./context");
  const context = await getBillingContext(operator);
  const openInvites = await prisma.invite.count({
    where: openInviteWhere(operator.id, new Date()),
  });
  if (context.memberCount + openInvites >= context.plan.maxMembers) {
    return { error: "error_limit_members" };
  }

  await prisma.invite.create({
    data: {
      companyId: operator.id,
      email,
      token: randomBytes(18).toString("hex"),
      role: str(formData, "role") === "viewer" ? "viewer" : "member",
    },
  });
  await logActivity(operator, "team.invite", { label: email });
  revalidatePath("/billing");
  return { ok: true };
}

export async function revokeInvite(formData: FormData) {
  const operator = await requireWriter();
  await prisma.invite.deleteMany({
    where: { id: str(formData, "inviteId"), companyId: operator.id, usedAt: null },
  });
  revalidatePath("/billing");
}

/** What a member may do: work in the workspace, or only look. Owner only. */
export async function setMemberRole(formData: FormData) {
  const operator = await requireWriter();
  if (operator.companyId) return;
  const role = str(formData, "role") === "viewer" ? "viewer" : "member";
  const changed = await prisma.operator.updateMany({
    where: { id: str(formData, "memberId"), companyId: operator.id },
    data: { role },
  });
  if (changed.count > 0) await logActivity(operator, "team.role", { id: str(formData, "memberId"), label: role });
  revalidatePath("/settings");
}

// Detaches the member from the company: they keep their sign-in, with an
// empty workspace of their own. Everything they entered stays the company's.
// Their open sessions end, so a removed person is not left looking at the
// company's data in a tab still open.
export async function removeMember(formData: FormData) {
  const operator = await requireWriter();
  const memberId = str(formData, "memberId");
  const removed = await prisma.operator.updateMany({
    where: { id: memberId, companyId: operator.id },
    data: { companyId: null, accountType: "personal", role: "owner" },
  });
  // Only someone who really was this company's member is signed out.
  if (removed.count > 0) {
    await prisma.session.deleteMany({ where: { operatorId: memberId } });
    await logActivity(operator, "team.remove", { id: memberId });
  }
  revalidatePath("/billing");
  revalidatePath("/settings");
}
