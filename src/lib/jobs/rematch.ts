import { prisma } from "../db";
import { syncSource } from "../ingest";
import { parseReasons, runMatchingForRequest } from "../match-service";
import {
  buildNewMatchesNotification,
  MockNotifier,
  type Notifier,
} from "../notify/mock";
import type { ListingSource } from "../sources/types";

// The scheduled job behind "saved search + notify":
//   1. sync every registered ListingSource (new/refreshed listings),
//   2. re-run matching for every active SearchRequest,
//   3. queue a notification (MockNotifier for now) for each request that
//      gained new matches, marking those matches notified.
//
// Framework-free so it can run from a cron script, a route handler, or tests.

export interface RematchSummary {
  sourcesSynced: number;
  listingsFetched: number;
  listingsCreated: number;
  activeSearches: number;
  notificationsSent: number;
}

export async function runScheduledRematch(params: {
  sources: ListingSource[];
  notifier?: Notifier;
}): Promise<RematchSummary> {
  const notifier = params.notifier ?? new MockNotifier();

  // 1. ingest
  let listingsFetched = 0;
  let listingsCreated = 0;
  for (const source of params.sources) {
    const sync = await syncSource(source);
    listingsFetched += sync.fetched;
    listingsCreated += sync.created;
  }

  // 2 + 3. re-match each active saved search and notify on new matches
  const activeSearches = await prisma.searchRequest.findMany({
    where: { isActive: true },
  });

  let notificationsSent = 0;

  for (const search of activeSearches) {
    const outcome = await runMatchingForRequest(search.id);
    if (outcome.newMatchIds.length === 0) continue;

    const newMatches = await prisma.match.findMany({
      where: { id: { in: outcome.newMatchIds }, notified: false },
      orderBy: { score: "desc" },
      include: { listing: true },
    });
    if (newMatches.length === 0) continue;

    const topSummaries = newMatches.slice(0, 3).map((m) => {
      const reasons = parseReasons(m.reasons);
      const l = m.listing;
      return (
        reasons.explanation ||
        `${l.propertyType} in ${l.district}, $${l.price}/mo — ${l.sourceUrl}`
      );
    });

    await notifier.send(
      buildNewMatchesNotification({
        to: search.userEmail,
        searchRequestId: search.id,
        rawQuery: search.rawQuery,
        matchIds: newMatches.map((m) => m.id),
        topSummaries,
      }),
    );
    notificationsSent += 1;

    await prisma.match.updateMany({
      where: { id: { in: newMatches.map((m) => m.id) } },
      data: { notified: true },
    });
  }

  return {
    sourcesSynced: params.sources.length,
    listingsFetched,
    listingsCreated,
    activeSearches: activeSearches.length,
    notificationsSent,
  };
}
