// Local job runner — the same jobs Vercel Cron runs in production through
// /api/cron (lib/automation/run.ts), without HTTP. Start with
// `npm run scheduler`.
//
// Every SYNC_INTERVAL_MINUTES it pulls the iCal calendars; once a day, from
// 08:00 Tbilisi time, it runs the full daily job instead (sync, alert scan,
// WhatsApp delivery), exactly like the production cron.

import "dotenv/config";
import { prisma } from "../lib/db";
import { runAutomation } from "../lib/automation/run";
import { hourTbilisi, sameTbilisiDay } from "../lib/time";

const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 60);
/** Tenants hear from us in the morning, not in the middle of the night. */
const DAILY_FROM_HOUR = 8;

async function tick() {
  const now = new Date();
  const lastDaily = await prisma.systemRun.findFirst({
    where: { kind: "daily" },
    orderBy: { startedAt: "desc" },
  });
  const dailyDue =
    hourTbilisi(now) >= DAILY_FROM_HOUR && (!lastDaily || !sameTbilisiDay(lastDaily.startedAt, now));
  const kind = dailyDue ? "daily" : "sync";
  try {
    const { ok, summary } = await runAutomation(kind, now);
    console.log(
      `[${now.toISOString()}] ${kind}: ${summary.feeds} feeds (+${summary.bookingsCreated} ~${summary.bookingsUpdated}, ${summary.feedErrors} errors)` +
        (kind === "daily"
          ? `, alerts +${summary.alertsCreated} / closed ${summary.alertsResolved}, WhatsApp sent ${summary.sent}, failed ${summary.failed}, waiting ${summary.pending}`
          : "") +
        (ok ? "" : ` — ${summary.failedOperators.length} workspace(s) failed`),
    );
  } catch (error) {
    console.error(`[${now.toISOString()}] ${kind} run failed:`, error);
  }
}

console.log(`Scheduler started — calendars every ${intervalMinutes} min, the daily job from ${DAILY_FROM_HOUR}:00 Tbilisi.`);
void tick();
setInterval(() => void tick(), intervalMinutes * 60 * 1000);
