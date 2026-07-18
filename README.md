# Tbilisi Rental Concierge

An **AI property concierge for the Georgian rental market** (MVP). Instead of browsing listing sites, you describe the home you want in plain language — English or Georgian — and the system extracts structured criteria, matches them against rental listings, filters/dedupes/ranks them, and surfaces only the strong matches, each with a one-line "why this matches" and a link back to the original listing.

It is a **matching + redirect layer**, not a listing republisher: the app always links to the source and never hosts anyone else's listing content or personal data.

## Quick start

```bash
git clone <repo-url>
cd tbilisi-rental-concierge
npm install
cp .env.example .env        # works as-is; add ANTHROPIC_API_KEY for real AI
npx prisma migrate dev      # creates the local SQLite DB + runs the seed
npm run dev                 # http://localhost:3000
```

If the DB already exists and you just want fresh data:

```bash
npm run db:seed
```

That's it — no API key, no hosted services required. Without `ANTHROPIC_API_KEY` the app uses a **deterministic local stub** for both criteria extraction and match explanations, so everything runs offline. With a key set, extraction uses `claude-haiku-4-5` and explanations use `claude-sonnet-5` (both overridable via env).

## What's inside

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app (intake page at `/`) |
| `npm run db:seed` | Reseed ~80 realistic mock Tbilisi listings + a demo saved search |
| `npm run cron` | Run the scheduled job: ingest new mock listings, re-match all saved searches, queue notifications via the MockNotifier |
| `npm test` | Unit tests for the matching engine + extraction stub |
| `npm run typecheck` | Strict TypeScript check |
| `npm run db:studio` | Browse the DB in Prisma Studio |

## Key flows

1. **Intake** (`/`) — free-text description (EN/KA toggle in the header). `POST /api/search-requests` sends the text to Claude with a strict tool schema (or the stub), validates the result with Zod, persists a `SearchRequest`, and runs matching immediately.
2. **Matching** — pure TypeScript engine (`src/lib/matching/`):
   - **Hard gates:** type == rent, price ≤ max, rooms/bedrooms ≥ requested (or exact), district ∈ requested set, available on or before the requested date, plus property type / min area when specified.
   - **Soft score (0–1, weighted):** furnished, heating, pets, district proximity (with an adjacency map for partial credit), recency, price headroom. Weights normalize over the signals the user actually expressed.
   - **Dedup:** near-duplicates (same street stem + bucketed price/area) collapse to the freshest posting.
   - **Staleness:** listings not seen within `LISTING_STALE_AFTER_DAYS` (default 21) are excluded.
3. **Delivery** (`/search/[id]`) — ranked matches with score badge, AI one-liner, key facts, and a **View original listing** button to `sourceUrl`.
4. **Saved search + notify** — every `SearchRequest` is persisted as active. `npm run cron` simulates the market moving (a small batch of new mock listings), re-matches every active search, and queues notifications for *new* matches through the `MockNotifier` (console log; `notified` flag prevents duplicates).

## Architecture

```
src/
  app/                      Next.js App Router (UI + API routes)
    page.tsx                intake page
    search/[id]/            results page (server component + client view)
    api/search-requests/    intake + re-match endpoints
  components/               header, EN/KA language provider
  lib/
    domain.ts               districts, adjacency, enums, i18n-ready names
    criteria.ts             Zod SearchCriteria schema (the AI ↔ engine contract)
    matching/               PURE engine: gates, scoring, dedupe, staleness
    ai/                     Claude extraction + explanation, deterministic stubs
    sources/                pluggable ListingSource interface + MockSource
    notify/                 pluggable Notifier interface + MockNotifier
    ingest.ts               source → DB upsert (idempotent by sourceUrl)
    match-service.ts        engine → DB persistence + explanations
    jobs/rematch.ts         the scheduled ingest→rematch→notify pipeline
prisma/
  schema.prisma             Listing, SearchRequest, Match, User
  seed.ts                   ~80 mock listings + demo user + demo search
scripts/cron.ts             scheduled-job entry point
tests/                      engine + extraction unit tests (vitest)
```

Design decisions worth knowing:

- **The matching engine and AI layer are framework-free.** `runMatching(criteria, listings, options)` is a pure function with an injectable clock — trivially unit-testable, and a clean seam for adding vector/embedding search later.
- **Ingestion is a pluggable adapter interface** (`ListingSource`). Only `MockSource` exists in the MVP; a partner API or compliant feed plugs in behind the same interface with no downstream changes.
- **SQLite locally, Postgres-compatible schema.** JSON fields are stored as strings; switch `datasource` to `postgresql` later without model changes.
- **Secrets only via env** (`.env.example` documents everything). The Anthropic key is never hardcoded, and its absence degrades gracefully to stubs.

## Legal / data constraints (baked in)

- **Mock data only** in the MVP — no scraping, no republishing of third-party personal data (owner phone numbers etc. are never stored or displayed).
- Every listing stores and displays a **link back to the original source**; this app never becomes the primary host of someone else's listing content.
- Georgia's Personal Data Protection Law (2023, GDPR-aligned) applies: the only personal data handled is the user's email (used as a minimal identifier for saved searches) and locale. No tracking, no third-party sharing.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite locally; Postgres-ready |
| `ANTHROPIC_API_KEY` | *(empty)* | Enables real Claude calls; stub fallback when empty |
| `ANTHROPIC_EXTRACTION_MODEL` | `claude-haiku-4-5` | Model for criteria extraction |
| `ANTHROPIC_EXPLANATION_MODEL` | `claude-sonnet-5` | Model for match explanations |
| `LISTING_STALE_AFTER_DAYS` | `21` | Staleness window for matching |

## Out of scope (designed for, not built)

Real portal integrations (adapter interface is ready), payments/subscriptions, full auth (email identifier only for now), native mobile, real email/push delivery (Notifier interface is ready), vector search (scoring seam is ready).
