import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/automation/auth";
import { runAutomation } from "@/lib/automation/run";

// The platform's own clock. Vercel Cron calls it every morning (vercel.json:
// 04:00 UTC = 08:00 in Tbilisi) with `Authorization: Bearer $CRON_SECRET`:
// iCal sync, the alert scan and WhatsApp delivery for every workspace, then
// the deletion of expired sessions, old sign-in attempts and dead reset
// links (lib/auth/prune.ts — what the Privacy Policy's retention promises).
//
//   GET /api/cron             the daily run (sync + scan + send + prune)
//   GET /api/cron?only=sync   calendars only — safe to call hourly from an
//                             external scheduler with the same header
//
// No session is involved; without CRON_SECRET configured it refuses
// everything (503).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth !== "ok") {
    return NextResponse.json({ error: auth }, { status: auth === "not_configured" ? 503 : 401 });
  }
  const only = new URL(request.url).searchParams.get("only");
  const { id, ok, summary } = await runAutomation(only === "sync" ? "sync" : "daily");
  // Counts only: which workspace failed, and why, stays in the SystemRun row.
  const { failedOperators, errors: _errors, ...counts } = summary;
  void _errors;
  return NextResponse.json(
    { ok, run: id, ...counts, failedWorkspaces: failedOperators.length },
    { status: ok ? 200 : 500 },
  );
}
