import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/auth/session";
import { scanAlerts } from "@/lib/alerts/scan";
import { flushOutbox } from "@/lib/notify/whatsapp";

// Runs the alert scan for the signed-in workspace and delivers its own
// outbox. The scheduled run for every workspace is /api/cron.
async function handle() {
  const operator = await getSessionOperator();
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await scanAlerts(new Date(), operator.id);
  const outbox = await flushOutbox(operator.id).catch(() => null);
  return NextResponse.json({ ...result, outbox });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
