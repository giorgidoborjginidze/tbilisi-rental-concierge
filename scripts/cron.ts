import { prisma } from "../src/lib/db";
import { runScheduledRematch } from "../src/lib/jobs/rematch";
import { MockSource } from "../src/lib/sources/mock";

// Scheduled matching job (run manually with `npm run cron`, or from a real
// scheduler later). Each run simulates the market moving: the MockSource emits a
// small batch of brand-new listings (seeded by day so reruns within a day are
// idempotent), then every active saved search is re-matched and new matches are
// queued through the MockNotifier.

async function main() {
  const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

  // A small fresh batch, distinct externalIds from the base seed data.
  const freshSource = new MockSource({
    count: 8,
    seed: daySeed,
    staleFraction: 0,
    duplicateFraction: 0,
  });
  // Namespace the ids so they never collide with the seed batch.
  const base = freshSource.generate().map((l) => ({
    ...l,
    externalId: `cron-${daySeed}-${l.externalId}`,
    sourceUrl: `https://mock.listings.local/l/cron-${daySeed}-${l.externalId}`,
  }));

  const summary = await runScheduledRematch({
    sources: [
      {
        key: "mock",
        fetchListings: async () => base,
      },
    ],
  });

  console.log(
    [
      "Scheduled rematch complete:",
      `  sources synced:      ${summary.sourcesSynced}`,
      `  listings fetched:    ${summary.listingsFetched}`,
      `  listings created:    ${summary.listingsCreated}`,
      `  active searches:     ${summary.activeSearches}`,
      `  notifications sent:  ${summary.notificationsSent}`,
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
