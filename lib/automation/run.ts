// The automatic jobs, for every workspace: pull the Airbnb / Booking
// calendars (iCal), run the alert scan (vacancies, double bookings, late
// rent, expiring contracts, silent trackers — it also queues the WhatsApp
// reminders) and deliver each workspace's own outbox. The daily run also
// deletes the sign-in records the Privacy Policy says are not kept (expired
// sessions, day-old rate-limit attempts, used or expired reset links).
//
// Called by Vercel Cron through /api/cron (once a day on the Hobby plan)
// and by the local `npm run scheduler`. Every run is recorded as a
// SystemRun row, which /alerts shows ("last automatic run"), so a failing
// job is noticed rather than silently leaving the owner uninformed.
//
// One workspace failing never stops the others; its id is recorded (no
// names, no phone numbers) and that owner sees the failure on /alerts.

import { prisma } from "@/lib/db";
import { scanAlerts } from "@/lib/alerts/scan";
import { syncAllUnits } from "@/lib/ical/run-sync";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { pruneAuthRecords } from "@/lib/auth/prune";
import { checkTrackerSilence } from "@/lib/geo/silence-check";

export type RunKind = "daily" | "sync";

export interface RunSummary {
  operators: number;
  feeds: number;
  bookingsCreated: number;
  bookingsUpdated: number;
  /** Stays cancelled because they vanished from their channel feed. */
  bookingsCancelled: number;
  feedErrors: number;
  alertsCreated: number;
  alertsResolved: number;
  sent: number;
  failed: number;
  pending: number;
  /** Sign-in rows deleted by the daily pruning (sessions + attempts + reset links). */
  authRowsPruned: number;
  /** The daily pruning threw (the workspaces' part may still be fine). */
  pruneFailed: boolean;
  /** Workspaces whose part of the run threw. */
  failedOperators: string[];
  /** Short error texts, for the logs. */
  errors: string[];
}

export interface RunDeps {
  sync: typeof syncAllUnits;
  scan: typeof scanAlerts;
  flush: typeof flushOutbox;
  prune: (now: Date) => ReturnType<typeof pruneAuthRecords>;
  /** The silent-tracker check (lib/geo/silence-check.ts), run on every sync too. */
  silence?: (now: Date, operatorId: string) => Promise<number>;
  /** Milliseconds since the run began (tests pass their own clock). */
  elapsed?: () => number;
}

const DEFAULT_DEPS: RunDeps = {
  sync: syncAllUnits,
  scan: scanAlerts,
  flush: flushOutbox,
  prune: (now) => pruneAuthRecords(prisma, now),
  silence: checkTrackerSilence,
};

/**
 * The function has 300 s (app/api/cron/route.ts). Past this point the
 * remaining workspaces skip their calendar pull (each feed may take up to
 * 15 s) and only get the scan and delivery, so a run with many slow feeds
 * still reaches every workspace's late rent and messages.
 */
export const SYNC_BUDGET_MS = 150_000;
/** Past this point the run stops starting workspaces, so it can record itself. */
export const RUN_BUDGET_MS = 270_000;

const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 200);

export async function runAutomation(
  kind: RunKind,
  now: Date = new Date(),
  deps: RunDeps = DEFAULT_DEPS,
): Promise<{ id: string; ok: boolean; summary: RunSummary }> {
  const run = await prisma.systemRun.create({ data: { kind, startedAt: now } });
  const summary: RunSummary = {
    operators: 0,
    feeds: 0,
    bookingsCreated: 0,
    bookingsUpdated: 0,
    bookingsCancelled: 0,
    feedErrors: 0,
    alertsCreated: 0,
    alertsResolved: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    authRowsPruned: 0,
    pruneFailed: false,
    failedOperators: [],
    errors: [],
  };

  const operators = await prisma.operator.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  summary.operators = operators.length;
  const began = Date.now();
  const elapsed = deps.elapsed ?? (() => Date.now() - began);

  for (const { id } of operators) {
    if (elapsed() > RUN_BUDGET_MS) {
      // Out of time: recorded as not done, so /alerts says so and the
      // cron answers 500 — never a silently half-finished run.
      summary.failedOperators.push(id);
      continue;
    }
    try {
      // Calendars first, so the scan sees today's bookings — while there is
      // time for them.
      const feeds = elapsed() > SYNC_BUDGET_MS ? [] : await deps.sync(undefined, id);
      summary.feeds += feeds.filter((feed) => !feed.demo).length;
      summary.bookingsCreated += feeds.reduce((sum, feed) => sum + feed.created, 0);
      summary.bookingsUpdated += feeds.reduce((sum, feed) => sum + feed.updated, 0);
      summary.bookingsCancelled += feeds.reduce((sum, feed) => sum + feed.cancelled, 0);
      // A broken feed URL is the owner's setting, not a failed run.
      summary.feedErrors += feeds.filter((feed) => feed.error).length;

      if (kind === "daily") {
        const scan = await deps.scan(now, id);
        summary.alertsCreated += scan.created;
        summary.alertsResolved += scan.resolved;
        // This workspace's own queue only.
        const flushed = await deps.flush(id);
        summary.sent += flushed.sent;
        summary.failed += flushed.failed;
        summary.pending += flushed.pending;
      } else if (deps.silence) {
        // Between the daily runs: a tracker that went quiet is still noticed.
        summary.alertsCreated += await deps.silence(now, id);
      }
    } catch (error) {
      summary.failedOperators.push(id);
      summary.errors.push(message(error));
      console.error(`[automation] ${kind} run failed for workspace ${id}:`, error);
    }
  }

  if (kind === "daily") {
    try {
      const pruned = await deps.prune(now);
      summary.authRowsPruned = pruned.sessions + pruned.attempts + pruned.resets;
    } catch (error) {
      summary.pruneFailed = true;
      summary.errors.push(`prune: ${message(error)}`);
      console.error(`[automation] pruning sign-in records failed:`, error);
    }
  }

  // A failed prune fails the run (the cron answers 500, so it is noticed),
  // but no workspace is marked: owners' /alerts only reflect their own part.
  const ok = summary.failedOperators.length === 0 && !summary.pruneFailed;
  await prisma.systemRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), ok, summary: summary as never },
  });
  return { id: run.id, ok, summary };
}

export interface LastRunView {
  at: Date;
  /** This workspace's part of the run went through. */
  ok: boolean;
  /** The run is older than a day and a bit: the schedule is not firing. */
  late: boolean;
}

/** A daily run is expected every 24 hours; after 26 the owner is told. */
export const RUN_LATE_AFTER_MS = 26 * 3_600_000;

/**
 * The last automatic daily run as one workspace sees it — for /alerts.
 * Null when the job has never run (e.g. CRON_SECRET not set yet).
 */
export async function lastRunFor(operatorId: string, now: Date = new Date()): Promise<LastRunView | null> {
  const run = await prisma.systemRun.findFirst({
    where: { kind: "daily", finishedAt: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return null;
  const failed = ((run.summary as { failedOperators?: string[] } | null)?.failedOperators ?? []).includes(
    operatorId,
  );
  return {
    at: run.finishedAt ?? run.startedAt,
    ok: !failed,
    late: now.getTime() - run.startedAt.getTime() > RUN_LATE_AFTER_MS,
  };
}
