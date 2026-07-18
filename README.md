# STR Operator Dashboard (Phase 1)

Property-operations tool for short-term-rental (STR) and aparthotel operators in
Georgia (Tbilisi & Batumi). One dashboard for the whole portfolio: units, a
unified booking calendar synced from Airbnb / Booking.com iCal feeds, occupancy
and revenue analytics, rule-based price suggestions against district benchmarks,
and proactive alerts for vacancy gaps and expiring leases.

This app is also the permissioned supply source for a separate future
guest/renter concierge (Phase 2) — the data model is kept clean and exportable.

## Stack

- **Next.js** (App Router) + **TypeScript** (strict) + **Tailwind CSS v4**
- **Prisma 7** ORM with **SQLite** locally (via `@prisma/adapter-better-sqlite3`;
  schema kept Postgres-compatible for later)
- **Anthropic API** (Claude) for pricing rationales — optional, falls back to a
  deterministic local stub when `ANTHROPIC_API_KEY` is unset

## Getting started

```bash
npm install
cp .env.example .env        # ANTHROPIC_API_KEY is optional
npx prisma migrate dev      # creates prisma/dev.db and applies migrations
npx prisma db seed          # loads the sample portfolio (12 units, ~450 bookings)
npm run dev                 # http://localhost:3000
```

> **Windows note:** Windows PowerShell 5.1 doesn't support `&&` — run the
> commands above one per line (use `Copy-Item .env.example .env` for the
> copy), or upgrade to PowerShell 7+.

Useful scripts: `npm run db:migrate`, `npm run db:seed`, `npm run db:studio`,
`npm test` (vitest), `npm run scheduler` (recurring iCal sync + alert scan,
interval set by `SYNC_INTERVAL_MINUTES`).

## Alerts

The scan job (`POST /api/alerts/scan`, the **Scan now** button on `/alerts`,
or the scheduler) creates three alert types, each with a suggested action:
vacancy gaps of 2+ nights in the next 30 days, active leases expiring within
30 days, and units priced materially below their district benchmark. Alerts
dedupe on a stable key — dismissed or resolved alerts never reappear.

## iCal sync

Each unit stores its channels' iCal export URLs (`/units` → edit). Sync runs
three ways: the **Sync calendars** button on the units page, `POST /api/sync`
(cron-friendly; GET works too), or the local scheduler (`npm run scheduler`).
Feeds are parsed with a dependency-free RFC 5545 parser
(`lib/ical/parse.ts`), availability blocks ("Not available"/"Blocked"/
"CLOSED") are skipped, and bookings are deduped by
`unitId + source + externalId` (feed UID, or the stay window when a feed has
no UIDs) — re-syncing updates instead of duplicating. Feed errors are
reported per-feed and never abort the run. Manual/direct bookings can be
added at `/bookings/new`.

## Seed data

One sample operator (**Kolkheti Stays**) with 12 units across Tbilisi districts
(Vake, Vera, Saburtalo, Old Town, Mtatsminda) and Batumi. Each unit has
bilingual (EN/KA) names, channel links with iCal URLs, several months of mixed
Airbnb / Booking / direct bookings (Feb–Oct 2026), a few long-stay leases, and
mock per-district market benchmarks. The seed is deterministic (seeded PRNG)
and idempotent — re-running it resets the data.

## Project structure

```
app/                  Next.js App Router pages + API routes
app/generated/prisma  Generated Prisma client (gitignored)
lib/db.ts             Prisma client singleton (SQLite adapter)
lib/i18n/             EN default / KA toggle string map
lib/calendar/         Vacancy-gap + overlap interval math (pure, tested)
lib/ical/             iCal parse + sync → Bookings (pure core, tested)
scripts/scheduler.ts  Local recurring job runner (iCal sync)
lib/analytics/        Occupancy, ADR, RevPAR, revenue math (pure, tested)
lib/pricing/          Rule-based pricing engine (pure, tested)
lib/market/           MarketDataSource interface + Db/Mock sources
lib/alerts/           Vacancy-gap / lease-expiry / underpriced scan job
lib/ai/               Claude rationale writer + deterministic stub
prisma/               Schema, migrations, seed
```

The iCal sync, analytics, and pricing modules are kept framework-free and
independently unit-testable.

## Data model

`Operator` → `Unit` (district, type, capacity, base rate, amenities, channel
iCal URLs) → `Booking` (source, dates, amount; deduped on
`unitId + source + externalId`) and `Lease` (long stays). Plus
`PricingSuggestion`, `MarketBenchmark` (district × month ADR/occupancy, mock
for the MVP), and `Alert` (`vacancy_gap` | `lease_expiry` | `underpriced`,
each carrying a suggested action).

Guest PII is minimal by design (Georgian Personal Data Protection Law /
GDPR-aligned): `guestName` is optional; a booking needs only source, dates,
and amount. Market benchmark data is mock behind a pluggable
`MarketDataSource` — no scraping/republishing of third-party listings.

## Roadmap (build order)

1. ✅ Scaffold: Next.js + TS + Tailwind + Prisma + SQLite
2. ✅ Prisma schema, migration, seed
3. ✅ Operator onboarding + unit management (add/edit units with iCal URLs)
4. ✅ iCal sync module + scheduled job + manual booking entry
5. ✅ Calendar view (per-unit + portfolio) with vacancy-gap & overlap detection
6. ✅ Analytics (occupancy, ADR, RevPAR, revenue) + dashboard
7. ✅ Benchmark + rule-based pricing engine with Claude-generated rationale
8. ✅ Alerts job (vacancy gaps, lease expiry, underpriced) + alerts UI
9. ✅ Unit tests for iCal parsing, calendar math, analytics, and the pricing engine (40 cases)

Out of scope for the MVP (designed for, not built): two-way channel APIs,
auto-posting to portals, payments/invoicing, ML pricing, and the Phase 2
guest-facing concierge.
