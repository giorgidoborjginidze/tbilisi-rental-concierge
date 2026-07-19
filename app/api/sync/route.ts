import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/auth/session";
import { syncAllUnits } from "@/lib/ical/run-sync";

// Cron-style endpoint: runs the iCal sync for the logged-in operator's
// units and reports per-feed results. (The local scheduler syncs all
// operators directly via the module, without HTTP.)
async function handle() {
  const operator = await getSessionOperator();
  if (!operator) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await syncAllUnits(undefined, operator.id);
  const summary = {
    feeds: results.length,
    created: results.reduce((sum, r) => sum + r.created, 0),
    updated: results.reduce((sum, r) => sum + r.updated, 0),
    errors: results.filter((r) => r.error).length,
  };
  return NextResponse.json({ summary, results });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
