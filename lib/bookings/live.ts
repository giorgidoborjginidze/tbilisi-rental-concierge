// The Prisma filter for stays that count: not cancelled, and not a copy of
// another stay (a Booking.com "CLOSED" block repeating Airbnb's nights —
// lib/ical/mirror.ts). Use it wherever stays feed revenue, occupancy,
// overlaps, vacancy windows, prices or the "no price" counts.
export const LIVE_STAY = { status: { not: "cancelled" }, mirrorOf: null } as const;
