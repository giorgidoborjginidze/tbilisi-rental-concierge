import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callbackOutcome, flittConfig, verifyFlittCallback } from "@/lib/billing/flitt";
import { renewedUntil } from "@/lib/billing/plans";

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

  // Success: claim the payment (two identical callbacks must not both add
  // a month), then activate the plan. The paid month is added after the
  // current paid-through date while it is still ahead — renewing early
  // loses no days.
  const now = new Date();
  const claimed = await prisma.payment.updateMany({
    where: { orderId: payment.orderId, status: { not: "approved" } },
    data: { status: "approved", paidAt: now, providerRef: result.providerRef },
  });
  if (claimed.count === 0) return NextResponse.json({ ok: true });

  const operator = await prisma.operator.findUnique({
    where: { id: payment.operatorId },
    select: { paidUntil: true },
  });
  await prisma.operator.update({
    where: { id: payment.operatorId },
    data: {
      plan: payment.plan,
      planSetAt: now,
      paidUntil: renewedUntil(operator?.paidUntil ?? null, now),
    },
  });

  return NextResponse.json({ ok: true });
}
