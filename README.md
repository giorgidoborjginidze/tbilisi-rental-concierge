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
  (2026 light-first design system: indigo primary, soft-shadow cards, Noto Sans Georgian)
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

## Authentication & multi-user

The app is multi-tenant: each operator registers with email + password
(`/register`), signs in at `/login`, and sees only their own units,
bookings, assets, alerts, and income. Passwords are hashed with Node's
built-in scrypt (no native dependencies); sessions are 30-day httpOnly
cookies backed by a `Session` table storing only the token's SHA-256.
Every page, server action, and API route is scoped to the signed-in
operator — cross-tenant record access returns 404, and the cron routes
return 401 without a session (the local scheduler still processes all
operators directly). The seeded demo account is
**ops@kolkhetistays.ge / demo1234** (shown on the login page).

## Deployment (Vercel + Neon Postgres)

The build is database-portable: `scripts/prepare-db.mjs` runs before
`next build` and follows `DATABASE_URL` — a `file:` URL generates the
SQLite client (local default), a `postgres…` URL derives
`prisma/schema.postgres.prisma` from the single source schema, generates
the Postgres client, and (on Vercel) runs `prisma db push` against the
database. To deploy: import the GitHub repo into Vercel, create a free
Postgres database (e.g. Neon), and set two environment variables —
`DATABASE_URL` (the Neon connection string) and optionally
`ANTHROPIC_API_KEY`. The runtime picks the matching driver adapter
automatically (`@prisma/adapter-pg` vs better-sqlite3). Note: the seed
script is for local SQLite demo data; production starts empty and users
register their own accounts.

## Plans & teams

Every new account gets a 30-day free trial with top-tier limits. After
that, a chosen plan's limits apply (payments land in a later stage —
choosing a plan on `/billing` activates it immediately). Personal tiers:
Starter 15₾ (5 assets / 3 units), Standard 29₾ (20 / 10), Pro 49₾
(50 / 30). Company tiers add team seats: Business S 99₾ (100 assets /
60 units / 5 seats), Business M 199₾ (300 / 200 / 15). Business owners
invite employees from `/billing` — the invite link
(`/register?invite=<token>`) joins the new account to the company, the
employee enters the listings they manage, and all limits are counted
company-wide. Creating assets/units past the plan limit is blocked with
an upgrade hint; over-limit records from a downgrade stay visible.

## Personal assets

The **Assets** section tracks the operator's own property portfolio beyond
STR: real estate (apartments, houses, commercial, land, garages) and movable
assets (vehicles, equipment). Each asset carries a status (rented / vacant /
personal use / listed — or "On STR" when linked to an STR unit), rental
contracts (tenant, term, monthly rent, deposit) with expiry alerts, a
market-rent estimate from mock per-district GEL/m² benchmarks (with a
below-market flag), and estimated value. Each asset stores its own listing
URLs per platform — myhome.ge / ss.ge / Airbnb / Booking.com for real
estate, myauto.ge for vehicles — plus a long-term vs daily rental mode.
One-click Rented/Vacant buttons update the status here and open the
asset's first listing in a new tab (the Georgian portals have no public
third-party APIs); assets in personal use show no listings or buttons at
all, and the buttons hide while an active contract governs the status.
Rentable real-estate assets also carry a digital door key: a one-click
6-digit code generator with a WhatsApp deep link that prefills the code
and address to the tenant's phone (from the contract) — no WhatsApp
Business API required. The page consolidates monthly
income: long-term rent from active contracts + STR revenue + manual entries
(salary, business, dividends).

## Alerts

The scan job (`POST /api/alerts/scan`, the **Scan now** button on `/alerts`,
or the scheduler) creates three alert types, each with a suggested action:
vacancy gaps of 2+ nights in the next 30 days, active leases and asset
rental contracts expiring within 30 days, and units priced materially below
their district benchmark. Alerts
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
each carrying a suggested action). Personal assets add `Asset`, `RentalContract`, `IncomeRecord`, and `RentBenchmark` (district × month GEL/m², mock).

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
