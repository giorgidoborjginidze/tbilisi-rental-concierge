import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callbackOutcome, flittConfig, verifyFlittCallback } from "@/lib/billing/flitt";
import { paidUntilAfterPayment } from "@/lib/billing/plans";

// Server-to-server payment callback from Flitt. Flitt POSTs the final order
// status here (form-urlencoded or JSON). We verify the signature, then — and
// only then — activate the plan. This is the source of truth, not the
// buyer's browser redirect (which can be lost or spoofed).
export const dynamic = "force-dynamic";

async function readFields(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const raw = await request.text();

  // JSON body — Flitt may wrap the payload in { response: {...} }.
  if (type.includes("application/json") || raw.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const obj = (parsed.response ?? parsed) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, String(v)]),
      );
    } catch {
      /* fall through to urlencoded */
    }
  }

  // Default: application/x-www-form-urlencoded.
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function POST(request: Request) {
  const cfg = flittConfig();
  if (!cfg) {
    console.error("[flitt] callback received but Flitt is not configured (FLITT_MERCHANT_ID / FLITT_SECRET_KEY)");
    return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  }
  const fields = await readFields(request);
  const result = verifyFlittCallback(fields, cfg);

  if (!result.valid || !result.orderId) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { orderId: result.orderId },
  });
  if (!payment) {
    return NextResponse.json({ error: "unknown order" }, { status: 404 });
  }

  // Already finalized — acknowledge without acting again (idempotent).
  if (payment.status === "approved") {
    return NextResponse.json({ ok: true });
  }

  const outcome = callbackOutcome(result.status, result.amountMinor === payment.amountMinor);
  if (outcome === "pending") {
    // "created" / "processing": the final callback follows.
    return NextResponse.json({ ok: true });
  }
  if (outcome === "declined") {
    // A later "approved" for the same order still activates (checked above
    // only for status "approved"), so a decline is never final by mistake.
    await prisma.payment.update({
      where: { orderId: payment.orderId },
      data: { status: "declined", providerRef: result.providerRef },
    });
    return NextResponse.json({ ok: true });
  }

  // Success: claim the payment and extend the plan in ONE transaction, so a
  // claimed payment always adds its month. Two identical callbacks must not
  // both add a month (the claim), and two approved orders of the same owner
  // arriving together must not both read the same paid-through date: the
  // operator row is written only if plan and paidUntil are still what was
  // read; otherwise the whole transaction is rolled back and tried again.
  const now = new Date();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const outcome = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { orderId: payment.orderId, status: { not: "approved" } },
        data: { status: "approved", paidAt: now, providerRef: result.providerRef },
      });
      if (claimed.count === 0) return "done" as const; // another callback got it

      const operator = await tx.operator.findUnique({
        where: { id: payment.operatorId },
        select: { plan: true, paidUntil: true, trialEndsAt: true },
      });
      if (!operator) return "done" as const;

      const written = await tx.operator.updateMany({
        where: { id: payment.operatorId, plan: operator.plan, paidUntil: operator.paidUntil },
        data: {
          plan: payment.plan,
          planSetAt: now,
          paidUntil: paidUntilAfterPayment(operator, payment.plan, now),
        },
      });
      // Changed in between: throw to roll the claim back, then retry.
      if (written.count === 0) throw new ConcurrentRenewal();
      return "done" as const;
    }).catch((err: unknown) => {
      if (err instanceof ConcurrentRenewal) return "retry" as const;
      throw err;
    });
    if (outcome === "done") return NextResponse.json({ ok: true });
  }

  // Still contended: answer with an error so Flitt delivers the callback
  // again (the payment is not claimed, so the retry does the work).
  console.error(`[flitt] renewal for order ${payment.orderId} kept colliding; asking Flitt to retry`);
  return NextResponse.json({ error: "busy, retry" }, { status: 503 });
}

const MAX_ATTEMPTS = 3;

class ConcurrentRenewal extends Error {}
