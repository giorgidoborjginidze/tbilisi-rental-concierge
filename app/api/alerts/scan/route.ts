import { NextResponse } from "next/server";
import { scanAlerts } from "@/lib/alerts/scan";

// Cron-style endpoint: runs the alert scan (vacancy gaps, lease expiries,
// underpriced units). POST or GET for simple schedulers.
async function handle() {
  const result = await scanAlerts();
  return NextResponse.json(result);
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
