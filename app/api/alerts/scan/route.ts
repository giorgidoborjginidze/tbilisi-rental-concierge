import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/auth/session";
import { scanAlerts } from "@/lib/alerts/scan";

// Cron-style endpoint: runs the alert scan for the logged-in operator.
// (The local scheduler scans all operators directly via the module.)
async function handle() {
  const operator = await getSessionOperator();
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await scanAlerts(new Date(), operator.id);
  return NextResponse.json(result);
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
