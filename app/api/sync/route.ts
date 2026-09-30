import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/auth/session";
import { summarizeSync, syncAllUnits } from "@/lib/ical/run-sync";

// Runs the iCal sync for the signed-in workspace's units and reports
// per-feed results. The scheduled sync for every workspace is /api/cron.
async function handle() {
  const operator = await getSessionOperator();
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await syncAllUnits(undefined, operator.id);
  // Errors are short codes ("gone", "blocked_host"…) — never the raw
  // network error, which could describe hosts behind the server.
  return NextResponse.json({ summary: summarizeSync(results), results });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
