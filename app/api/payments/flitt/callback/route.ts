import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyFlittCallback } from "@/lib/billing/flitt";

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
  const fields = await readFields(request);
  const result = verifyFlittCallback(fields);

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

  const approved =
    result.status === "approved" && result.amountMinor === payment.amountMinor;

  if (!approved) {
    await prisma.payment.update({
      where: { orderId: payment.orderId },
      data: { status: "declined", providerRef: result.providerRef },
    });
    return NextResponse.json({ ok: true });
  }

  // Success: activate the plan and extend the paid-through date by a month.
  const now = new Date();
  const paidUntil = new Date(now);
  paidUntil.setMonth(paidUntil.getMonth() + 1);

  await prisma.$transaction([
    prisma.payment.update({
      where: { orderId: payment.orderId },
      data: { status: "approved", paidAt: now, providerRef: result.providerRef },
    }),
    prisma.operator.update({
      where: { id: payment.operatorId },
      data: { plan: payment.plan, planSetAt: now, paidUntil },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
