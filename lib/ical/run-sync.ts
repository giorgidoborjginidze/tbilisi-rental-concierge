// DB-bound orchestration of the iCal sync: fetch each unit's feeds (through
// the SSRF guard in ./fetch), parse, and apply the plan from ./reconcile —
// create new stays, update known ones, cancel the ones that vanished from
// the feed. Every feed's outcome is stored on its UnitFeed row, so the
// owner sees when each calendar last synced and what went wrong.
//
// The fetcher is injectable so the whole flow is testable without a network.

import { prisma } from "@/lib/db";
import { parseChannelLinks } from "@/lib/types";
import { parseIcal } from "./parse";
import { eventsToBookings, isDemoFeedUrl, sourceFromUrl } from "./sync";
import { feedErrorOf, fetchFeed, type FeedError } from "./fetch";
import { planFeedSync } from "./reconcile";

export type IcalFetcher = (url: string) => Promise<string>;

export interface FeedSyncResult {
  unitId: string;
  unitName: string;
  url: string;
  source: string;
  created: number;
  updated: number;
  /** Stays marked cancelled because they are no longer in the feed. */
  cancelled: number;
  /** A short code the owner can be shown (never the raw network error). */
  error?: FeedError;
  /** HTTP status of a failed fetch, when the channel answered. */
  status?: number;
  /** A demo placeholder link: not fetched. */
  demo?: boolean;
}

const defaultFetcher: IcalFetcher = (url) => fetchFeed(url);

/** The feed URLs of a unit, trimmed and without repeats. */
export function feedUrlsOf(channelLinks: unknown): string[] {
  return [...new Set(parseChannelLinks(channelLinks).icalUrls.map((url) => url.trim()).filter(Boolean))];
}

export async function syncAllUnits(
  fetchText: IcalFetcher = defaultFetcher,
  operatorId?: string,
  now: Date = new Date(),
): Promise<FeedSyncResult[]> {
  const units = await prisma.unit.findMany({
    where: operatorId ? { operatorId } : undefined,
  });
  const results: FeedSyncResult[] = [];

  for (const unit of units) {
    const urls = feedUrlsOf(unit.channelLinks);
    // Status rows of URLs the owner has since removed go with them (their
    // stays stay, with feedId cleared).
    await prisma.unitFeed.deleteMany({
      where: { unitId: unit.id, url: { notIn: urls } },
    });

    for (const url of urls) {
      const source = sourceFromUrl(url);
      const result: FeedSyncResult = {
        unitId: unit.id,
        unitName: unit.name,
        url,
        source,
        created: 0,
        updated: 0,
        cancelled: 0,
      };
      if (isDemoFeedUrl(url)) {
        results.push({ ...result, demo: true });
        continue;
      }
      const feed = await prisma.unitFeed.upsert({
        where: { unitId_url: { unitId: unit.id, url } },
        create: { unitId: unit.id, url, source },
        update: { source },
      });

      let text: string;
      try {
        text = await fetchText(url);
      } catch (error) {
        const { code, status } = feedErrorOf(error);
        result.error = code;
        if (status != null) result.status = status;
        await prisma.unitFeed.update({
          where: { id: feed.id },
          data: { lastAttemptAt: now, lastError: code, lastStatus: status },
        });
        results.push(result);
        continue;
      }

      const candidates = eventsToBookings(parseIcal(text), source);
      const existing = await prisma.booking.findMany({
        where: { unitId: unit.id, source, externalId: { not: null } },
        select: {
          id: true,
          externalId: true,
          feedId: true,
          status: true,
          cancelReason: true,
          cancelledAt: true,
          checkOut: true,
        },
      });
      const plan = planFeedSync(candidates, existing, {
        feedId: feed.id,
        // Stays imported before feeds were tracked belong to this feed
        // when it is the unit's only feed of that channel.
        ownsLegacy: urls.filter((other) => sourceFromUrl(other) === source).length === 1,
        now,
      });

      for (const candidate of plan.create) {
        try {
          await prisma.booking.create({
            data: {
              unitId: unit.id,
              source: candidate.source,
              checkIn: candidate.checkIn,
              checkOut: candidate.checkOut,
              nights: candidate.nights,
              status: candidate.status,
              externalId: candidate.externalId,
              currency: unit.currency,
              feedId: feed.id,
              ...(candidate.status === "cancelled"
                ? { cancelledAt: now, cancelReason: "channel" }
                : {}),
            },
          });
          result.created += 1;
        } catch (error) {
          // A sync running at the same moment (cron + the button) created
          // it first — nothing lost.
          if ((error as { code?: string }).code !== "P2002") throw error;
        }
      }
      for (const change of plan.update) {
        await prisma.booking.update({
          where: { id: change.id },
          data: { ...change.data, importedAt: now },
        });
        result.updated += 1;
      }
      if (plan.cancel.length > 0) {
        await prisma.booking.updateMany({
          where: { id: { in: plan.cancel }, status: { not: "cancelled" } },
          data: { status: "cancelled", cancelledAt: now, cancelReason: "missing" },
        });
        result.cancelled = plan.cancel.length;
      }

      await prisma.unitFeed.update({
        where: { id: feed.id },
        data: {
          lastAttemptAt: now,
          lastSyncedAt: now,
          lastError: null,
          lastStatus: null,
          lastCount: candidates.filter((candidate) => candidate.status !== "cancelled").length,
          lastCancelled: result.cancelled,
        },
      });
      results.push(result);
    }
  }
  return results;
}

/** The totals the sync button reports back. */
export function summarizeSync(all: FeedSyncResult[]) {
  const results = all.filter((r) => !r.demo);
  return {
    feeds: results.length,
    demo: all.length - results.length,
    created: results.reduce((sum, r) => sum + r.created, 0),
    updated: results.reduce((sum, r) => sum + r.updated, 0),
    cancelled: results.reduce((sum, r) => sum + r.cancelled, 0),
    errors: results.filter((r) => r.error).length,
  };
}
