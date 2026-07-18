import { extractCriteria } from "../src/lib/ai/extract";
import { prisma } from "../src/lib/db";
import { syncSource } from "../src/lib/ingest";
import { runMatchingForRequest } from "../src/lib/match-service";
import { MockSource } from "../src/lib/sources/mock";

// Seed the database with ~80 realistic mock Tbilisi rentals plus one demo user
// and a saved search (so the results page has something to show out of the box).
// Reproducible: the MockSource uses a fixed seed.

async function main() {
  console.log("Seeding Tbilisi rental concierge…");

  // Clean slate (idempotent re-seed).
  await prisma.match.deleteMany();
  await prisma.searchRequest.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // 1. Listings via the MockSource adapter (same interface real sources will use).
  const source = new MockSource({ count: 80, seed: 1337 });
  const sync = await syncSource(source);
  console.log(
    `  listings: fetched ${sync.fetched}, created ${sync.created}, updated ${sync.updated}`,
  );

  // 2. A minimal demo user.
  const demoEmail = "demo@tbilisi-concierge.local";
  await prisma.user.create({
    data: { email: demoEmail, locale: "en" },
  });

  // 3. A demo saved search + an initial matching run.
  const rawQuery =
    "2-bedroom furnished flat in Vera or Vake, under $1200/month, pet-friendly, available from September";
  const { criteria, source: extractionSource } = await extractCriteria(rawQuery);
  console.log(`  demo criteria extracted via: ${extractionSource}`);

  const searchRequest = await prisma.searchRequest.create({
    data: {
      userEmail: demoEmail,
      rawQuery,
      language: "en",
      structuredCriteria: JSON.stringify(criteria),
      isActive: true,
    },
  });

  const outcome = await runMatchingForRequest(searchRequest.id);
  console.log(
    `  demo matches: ${outcome.stats.returned} returned (of ${outcome.stats.total} listings; ${outcome.stats.passedHardGates} passed hard gates)`,
  );
  console.log(`  demo search id: ${searchRequest.id}`);

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
