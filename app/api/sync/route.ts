import { NextResponse } from "next/server";
import { syncAllUnits } from "@/lib/ical/run-sync";

// Cron-style endpoint: POST (or GET, for simple schedulers) runs a full
// iCal sync across all units and reports per-feed results.
async function handle() {
  const results = await syncAllUnits();
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
