import { NextResponse } from "next/server";
import { getSessionOperator, readOnlyOperator } from "@/lib/auth/session";
import { scanAlerts } from "@/lib/alerts/scan";
import { flushOutbox } from "@/lib/notify/whatsapp";

// Runs the alert scan for the signed-in workspace and delivers its own
// outbox. The scheduled run for every workspace is /api/cron.
//
// POST only: the scan can send WhatsApp messages, and the session cookie
// (SameSite=Lax) rides along on a cross-site link, so a GET would let any
// page pick the moment an owner's queue goes out.
export async function POST() {
  const operator = await getSessionOperator();
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The shared demo is read-only (lib/auth/session.ts requireWriter); the
  // daily job keeps its alerts current.
  if (readOnlyOperator(operator)) {
    return NextResponse.json({ error: "demo_readonly" }, { status: 403 });
  }
  const result = await scanAlerts(new Date(), operator.id);
  const outbox = await flushOutbox(operator.id).catch(() => null);
  return NextResponse.json({ ...result, outbox });
}
