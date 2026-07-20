import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { seasonalityFactor } from "../lib/pricing/seasonality";
import { hashPassword } from "../lib/auth/password";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

// Deterministic PRNG (mulberry32) so the seed is reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260718);

const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);
const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const DISTRICTS = [
  { name: "Vake", city: "Tbilisi", baseAdr: 170 },
  { name: "Vera", city: "Tbilisi", baseAdr: 160 },
  { name: "Saburtalo", city: "Tbilisi", baseAdr: 125 },
  { name: "Old Town", city: "Tbilisi", baseAdr: 210 },
  { name: "Mtatsminda", city: "Tbilisi", baseAdr: 190 },
  { name: "Batumi Boulevard", city: "Batumi", baseAdr: 150 },
];

interface UnitSpec {
  name: string;
  nameKa: string;
  city: string;
  district: string;
  address: string;
  type: string;
  capacity: number;
  bedrooms: number;
  baseNightlyRate: number;
  amenities: string[];
  airbnbListing: string;
  bookingListing?: string;
}

const UNIT_SPECS: UnitSpec[] = [
  {
    name: "Vake Park View 2BR", nameKa: "ვაკის პარკის ხედი — 2 საძინებელი",
    city: "Tbilisi", district: "Vake", address: "12 Ilia Chavchavadze Ave",
    type: "apartment", capacity: 4, bedrooms: 2, baseNightlyRate: 185,
    amenities: ["wifi", "ac", "washer", "balcony", "elevator"],
    airbnbListing: "41120001", bookingListing: "vake-park-view",
  },
  {
    name: "Vake Cozy Studio", nameKa: "ვაკის სტუდიო",
    city: "Tbilisi", district: "Vake", address: "5 Irakli Abashidze St",
    type: "studio", capacity: 2, bedrooms: 0, baseNightlyRate: 120,
    amenities: ["wifi", "ac", "washer"],
    airbnbListing: "41120002",
  },
  {
    name: "Vera Terrace 1BR", nameKa: "ვერას ტერასა — 1 საძინებელი",
    city: "Tbilisi", district: "Vera", address: "22 Tatishvili St",
    type: "apartment", capacity: 3, bedrooms: 1, baseNightlyRate: 150,
    amenities: ["wifi", "ac", "terrace", "washer"],
    airbnbListing: "41120003", bookingListing: "vera-terrace",
  },
  {
    name: "Vera Artist Loft", nameKa: "ვერას ლოფტი",
    city: "Tbilisi", district: "Vera", address: "8 Kiacheli St",
    type: "apartment", capacity: 2, bedrooms: 1, baseNightlyRate: 140,
    amenities: ["wifi", "washer", "workspace"],
    airbnbListing: "41120004",
  },
  {
    name: "Saburtalo Metro 1BR", nameKa: "საბურთალო მეტროსთან — 1 საძინებელი",
    city: "Tbilisi", district: "Saburtalo", address: "34 Vazha-Pshavela Ave",
    type: "apartment", capacity: 3, bedrooms: 1, baseNightlyRate: 100,
    amenities: ["wifi", "ac", "elevator", "parking"],
    airbnbListing: "41120005", bookingListing: "saburtalo-metro",
  },
  {
    name: "Saburtalo Family 3BR", nameKa: "საბურთალოს საოჯახო — 3 საძინებელი",
    city: "Tbilisi", district: "Saburtalo", address: "17 Pekini Ave",
    type: "apartment", capacity: 6, bedrooms: 3, baseNightlyRate: 160,
    amenities: ["wifi", "ac", "washer", "parking", "elevator", "crib"],
    airbnbListing: "41120006",
  },
  {
    name: "Old Town Balcony 1BR", nameKa: "ძველი თბილისის აივნიანი — 1 საძინებელი",
    city: "Tbilisi", district: "Old Town", address: "9 Kote Abkhazi St",
    type: "apartment", capacity: 2, bedrooms: 1, baseNightlyRate: 200,
    amenities: ["wifi", "ac", "balcony", "historic_building"],
    airbnbListing: "41120007", bookingListing: "old-town-balcony",
  },
  {
    name: "Old Town Wine Cellar Suite", nameKa: "ძველი ქალაქის მარნის სუიტა",
    city: "Tbilisi", district: "Old Town", address: "3 Shardeni St",
    type: "aparthotel_room", capacity: 2, bedrooms: 1, baseNightlyRate: 230,
    amenities: ["wifi", "ac", "daily_cleaning", "wine_cellar"],
    airbnbListing: "41120008", bookingListing: "wine-cellar-suite",
  },
  {
    name: "Mtatsminda Panorama 2BR", nameKa: "მთაწმინდის პანორამა — 2 საძინებელი",
    city: "Tbilisi", district: "Mtatsminda", address: "15 Daniel Chonqadze St",
    type: "apartment", capacity: 4, bedrooms: 2, baseNightlyRate: 210,
    amenities: ["wifi", "ac", "washer", "city_view", "fireplace"],
    airbnbListing: "41120009", bookingListing: "mtatsminda-panorama",
  },
  {
    name: "Rustaveli Classic 1BR", nameKa: "რუსთაველის კლასიკა — 1 საძინებელი",
    city: "Tbilisi", district: "Mtatsminda", address: "28 Rustaveli Ave",
    type: "apartment", capacity: 3, bedrooms: 1, baseNightlyRate: 180,
    amenities: ["wifi", "ac", "elevator", "high_ceilings"],
    airbnbListing: "41120010",
  },
  {
    name: "Batumi Sea View Studio", nameKa: "ბათუმის ზღვის ხედი — სტუდიო",
    city: "Batumi", district: "Batumi Boulevard", address: "40 Khimshiashvili St",
    type: "studio", capacity: 2, bedrooms: 0, baseNightlyRate: 130,
    amenities: ["wifi", "ac", "sea_view", "pool", "elevator"],
    airbnbListing: "41120011", bookingListing: "batumi-sea-view",
  },
  {
    name: "Orbi Beach 1BR", nameKa: "ორბი ბიჩი — 1 საძინებელი",
    city: "Batumi", district: "Batumi Boulevard", address: "12 Sherif Khimshiashvili St",
    type: "aparthotel_room", capacity: 3, bedrooms: 1, baseNightlyRate: 150,
    amenities: ["wifi", "ac", "sea_view", "pool", "gym", "daily_cleaning"],
    airbnbListing: "41120012", bookingListing: "orbi-beach",
  },
];

interface DateRange {
  start: Date;
  end: Date;
}

const overlaps = (a: DateRange, b: DateRange) =>
  a.start < b.end && b.start < a.end;

// Walk the calendar from `from` to `to`, dropping stays with gaps sized by
// monthly demand; skips any stay that would overlap a blackout (lease) window.
function generateBookings(
  spec: UnitSpec,
  from: Date,
  to: Date,
  blackouts: DateRange[],
) {
  const bookings: {
    source: string;
    guestName: string | null;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    amount: number;
    currency: string;
    status: string;
    externalId: string | null;
  }[] = [];

  let cursor = addDays(from, randInt(0, 5));
  let uidCounter = 1;

  while (cursor < to) {
    const month = cursor.getUTCMonth() + 1;
    const factor = seasonalityFactor(spec.city, month);

    const nights = randInt(2, 7);
    const checkIn = cursor;
    const checkOut = addDays(checkIn, nights);
    const stay = { start: checkIn, end: checkOut };

    // Gap until the next stay: tighter in high season.
    const maxGap = factor >= 1.2 ? 2 : factor >= 1.0 ? 4 : 7;
    const gap = randInt(0, maxGap);

    if (blackouts.some((b) => overlaps(stay, b))) {
      cursor = addDays(cursor, nights + gap);
      continue;
    }

    const roll = rand();
    const source =
      roll < 0.45 ? "airbnb" : roll < 0.8 ? "booking" : roll < 0.9 ? "direct" : "manual";

    const nightlyRate = spec.baseNightlyRate * factor * (0.9 + rand() * 0.25);
    const status = rand() < 0.05 ? "cancelled" : "confirmed";
    const externalId =
      source === "airbnb"
        ? `${spec.airbnbListing}-${String(uidCounter).padStart(4, "0")}@airbnb.com`
        : source === "booking"
          ? `res-${spec.airbnbListing}-${String(uidCounter).padStart(4, "0")}@booking.com`
          : null;

    bookings.push({
      source,
      // Guest PII stays minimal: only some direct/manual bookings carry a name.
      guestName:
        (source === "direct" || source === "manual") && rand() < 0.7
          ? pick(["N. Kapanadze", "L. Tsereteli", "D. Weber", "A. Petrov", "M. Rossi"])
          : null,
      checkIn,
      checkOut,
      nights,
      amount: Math.round(nightlyRate * nights),
      currency: "GEL",
      status,
      externalId,
    });

    uidCounter += 1;
    cursor = addDays(cursor, nights + gap);
  }

  return bookings;
}

async function main() {
  // Idempotent re-seed: wipe in FK-safe order.
  await prisma.alert.deleteMany();
  await prisma.pricingSuggestion.deleteMany();
  await prisma.incomeRecord.deleteMany();
  await prisma.rentalContract.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.rentBenchmark.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.marketBenchmark.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.operator.deleteMany();

  const operator = await prisma.operator.create({
    data: {
      name: "Kolkheti Stays",
      email: "ops@kolkhetistays.ge",
      passwordHash: hashPassword("demo1234"),
      locale: "en",
      // Demo account: personal Pro plan (12 units / 11 assets need it).
      accountType: "personal",
      plan: "pro",
      planSetAt: utc(2026, 1, 15),
      trialEndsAt: utc(2026, 2, 14),
    },
  });

  const units: { unit: { id: string }; spec: UnitSpec }[] = [];
  for (const spec of UNIT_SPECS) {
    const icalUrls = [
      `https://www.airbnb.com/calendar/ical/${spec.airbnbListing}.ics?s=demo`,
      ...(spec.bookingListing
        ? [`https://ical.booking.com/v1/export?t=${spec.bookingListing}-demo`]
        : []),
    ];
    const unit = await prisma.unit.create({
      data: {
        operatorId: operator.id,
        name: spec.name,
        nameKa: spec.nameKa,
        city: spec.city,
        district: spec.district,
        address: spec.address,
        type: spec.type,
        capacity: spec.capacity,
        bedrooms: spec.bedrooms,
        baseNightlyRate: spec.baseNightlyRate,
        currency: "GEL",
        amenities: spec.amenities,
        channelLinks: {
          airbnbUrl: `https://www.airbnb.com/rooms/${spec.airbnbListing}`,
          bookingUrl: spec.bookingListing
            ? `https://www.booking.com/hotel/ge/${spec.bookingListing}.html`
            : null,
          icalUrls,
        },
      },
    });
    units.push({ unit, spec });
  }

  // Long stays. Saburtalo Family 3BR's lease ends soon → lease-expiry alert demo.
  const byName = (name: string) => units.find((u) => u.spec.name === name)!.unit;
  const leases = [
    {
      unitId: byName("Saburtalo Family 3BR").id,
      tenantName: "T. Beridze",
      startDate: utc(2026, 3, 1),
      endDate: utc(2026, 8, 15),
      monthlyRent: 2500,
      status: "active",
    },
    {
      unitId: byName("Orbi Beach 1BR").id,
      tenantName: null,
      startDate: utc(2025, 11, 1),
      endDate: utc(2026, 5, 31),
      monthlyRent: 1400,
      status: "ended",
    },
    {
      unitId: byName("Vake Cozy Studio").id,
      tenantName: "G. Maisuradze",
      startDate: utc(2026, 9, 1),
      endDate: utc(2027, 3, 1),
      monthlyRent: 1800,
      status: "upcoming",
    },
  ];
  for (const lease of leases) {
    await prisma.lease.create({ data: { ...lease, currency: "GEL" } });
  }

  // Bookings Feb–Oct 2026, skipping each unit's leased windows.
  const from = utc(2026, 2, 1);
  const to = utc(2026, 11, 1);
  let bookingCount = 0;
  for (const { unit, spec } of units) {
    const blackouts = leases
      .filter((l) => l.unitId === unit.id)
      .map((l) => ({ start: l.startDate, end: l.endDate }));
    for (const b of generateBookings(spec, from, to, blackouts)) {
      await prisma.booking.create({ data: { ...b, unitId: unit.id } });
      bookingCount += 1;
    }
  }

  // Mock market benchmarks per district per month of 2026.
  let benchmarkCount = 0;
  for (const district of DISTRICTS) {
    for (let month = 1; month <= 12; month++) {
      const factor = seasonalityFactor(district.city, month);
      await prisma.marketBenchmark.create({
        data: {
          district: district.name,
          month: monthKey(utc(2026, month, 1)),
          adr: Math.round(district.baseAdr * factor),
          occupancyRate: Math.min(0.95, Number((0.62 * factor + rand() * 0.08).toFixed(2))),
          sampleSize: randInt(40, 220),
          source: "mock",
        },
      });
      benchmarkCount += 1;
    }
  }

  // Long-term rent benchmarks per district per month (GEL/m², mock).
  const RENT_PER_SQM: Record<string, number> = {
    Vake: 32, Vera: 30, Saburtalo: 25, "Old Town": 34,
    Mtatsminda: 33, "Batumi Boulevard": 22,
  };
  let rentBenchmarkCount = 0;
  for (const district of DISTRICTS) {
    for (let month = 1; month <= 12; month++) {
      await prisma.rentBenchmark.create({
        data: {
          district: district.name,
          month: monthKey(utc(2026, month, 1)),
          avgRentPerSqm: RENT_PER_SQM[district.name] + (month >= 6 && month <= 9 ? 1 : 0),
          sampleSize: randInt(30, 150),
          source: "mock",
        },
      });
      rentBenchmarkCount += 1;
    }
  }

  // Personal assets: real estate and vehicles, some rented out.
  const vakeUnit = byName("Vake Park View 2BR");
  const assets = [
    // 1) Long-term rented apartment, listed on myhome.ge
    {
      name: "Nutsubidze 2BR Apartment", nameKa: "ნუცუბიძის ბინა — 2 საძინებელი",
      category: "real_estate", type: "apartment",
      city: "Tbilisi", district: "Saburtalo", address: "45 Nutsubidze St",
      areaSqm: 72, estimatedValue: 280000, status: "rented",
      myhomeUrl: "https://www.myhome.ge/pr/21437651/",
      contract: {
        tenantName: "L. Gelashvili", tenantPhone: "+995 599 11 22 33",
        startDate: utc(2025, 9, 1), endDate: utc(2026, 8, 10),
        monthlyRent: 1400, deposit: 1400, status: "active",
      },
    },
    // 2) Commercial space listed on ss.ge
    {
      name: "Aghmashenebeli Retail Space", nameKa: "აღმაშენებლის კომერციული ფართი",
      category: "real_estate", type: "commercial",
      city: "Tbilisi", district: "Old Town", address: "112 Aghmashenebeli Ave",
      areaSqm: 45, estimatedValue: 320000, status: "listed",
      ssUrl: "https://home.ss.ge/ka/udzravi-qoneba/21437652",
    },
    // 3) House listed on Airbnb
    {
      name: "Didi Dighomi House", nameKa: "დიდი დიღმის სახლი",
      category: "real_estate", type: "house",
      city: "Tbilisi", district: "Saburtalo", address: "7 Petre Kavtaradze St",
      areaSqm: 140, estimatedValue: 390000, status: "listed",
      airbnbUrl: "https://www.airbnb.com/rooms/41120099",
    },
    // 4) Apartment listed on Booking.com
    {
      name: "Batumi Seaside 2BR", nameKa: "ბათუმის სანაპიროს ბინა",
      category: "real_estate", type: "apartment",
      city: "Batumi", district: "Batumi Boulevard", address: "5 Seaside St",
      areaSqm: 68, estimatedValue: 260000, status: "listed",
      bookingUrl: "https://www.booking.com/hotel/ge/batumi-seaside-2br.html",
    },
    // 5) One asset on three platforms at once, up for rent
    {
      name: "Vera Sunny 1BR", nameKa: "ვერას მზიანი ბინა",
      category: "real_estate", type: "apartment",
      city: "Tbilisi", district: "Vera", address: "14 Kiacheli St",
      areaSqm: 55, estimatedValue: 240000, status: "listed",
      myhomeUrl: "https://www.myhome.ge/pr/21437653/",
      ssUrl: "https://home.ss.ge/ka/udzravi-qoneba/21437653",
      airbnbUrl: "https://www.airbnb.com/rooms/41120098",
    },
    // 6) Daily-rental studio with a seeded door code
    {
      name: "Old Town Daily Studio", nameKa: "ძველი ქალაქის დღიური სტუდიო",
      category: "real_estate", type: "apartment",
      city: "Tbilisi", district: "Old Town", address: "6 Shardeni St",
      areaSqm: 38, estimatedValue: 210000, status: "vacant",
      rentalMode: "daily",
      myhomeUrl: "https://www.myhome.ge/pr/21437654/",
      airbnbUrl: "https://www.airbnb.com/rooms/41120097",
      doorCode: "483920", doorCodeGeneratedAt: utc(2026, 7, 15),
    },
    // 7) Personal use — no listings by design
    {
      name: "Tskneti Summer House", nameKa: "წყნეთის აგარაკი",
      category: "real_estate", type: "house",
      city: "Tbilisi", district: "Vake", address: "8 Tskneti Highway",
      areaSqm: 180, estimatedValue: 450000, status: "personal_use",
    },
    // 8) Linked to an STR unit
    {
      name: "Vake Park View 2BR (STR)", nameKa: "ვაკის პარკის ხედი (STR)",
      category: "real_estate", type: "apartment",
      city: "Tbilisi", district: "Vake", address: "12 Ilia Chavchavadze Ave",
      areaSqm: 85, estimatedValue: 700000, status: "vacant",
      unitId: vakeUnit.id,
      airbnbUrl: "https://www.airbnb.com/rooms/41120001",
    },
    // 9) Rented garage
    {
      name: "Vera Garage", nameKa: "ვერას გარაჟი",
      category: "real_estate", type: "garage",
      city: "Tbilisi", district: "Vera", address: "22 Tatishvili St",
      areaSqm: 18, estimatedValue: 35000, status: "rented",
      contract: {
        tenantName: "N. Adeishvili", tenantPhone: null,
        startDate: utc(2026, 1, 1), endDate: utc(2026, 12, 31),
        monthlyRent: 250, deposit: null, status: "active",
      },
    },
    // 10) Personal car — no listings by design
    {
      name: "Toyota Camry 2021", nameKa: "ტოიოტა კამრი 2021",
      category: "vehicle", type: "car",
      status: "personal_use", estimatedValue: 85000,
    },
    // 11) Rented-out car listed on myauto.ge
    {
      name: "Kia Sportage 2022", nameKa: "კია სპორტაჯი 2022",
      category: "vehicle", type: "car",
      status: "rented", estimatedValue: 95000,
      myautoUrl: "https://www.myauto.ge/ka/pr/118234567",
      contract: {
        tenantName: "G. Tsiklauri", tenantPhone: "+995 555 44 33 22",
        startDate: utc(2026, 5, 1), endDate: utc(2027, 5, 1),
        monthlyRent: 900, deposit: 900, status: "active",
      },
    },
    // 12) Recurring income stream — amount only, no payer details
    {
      name: "Salary", nameKa: "ხელფასი",
      category: "income_source", type: "salary",
      status: "personal_use", monthlyIncome: 5000,
    },
    // 13) Recurring dividend income
    {
      name: "Dividend — KolkhetiCo", nameKa: "დივიდენდი — KolkhetiCo",
      category: "income_source", type: "dividend",
      status: "personal_use", monthlyIncome: 1200,
    },
  ];
  let contractCount = 0;
  for (const { contract, ...assetData } of assets) {
    const asset = await prisma.asset.create({
      data: { ...assetData, operatorId: operator.id, currency: "GEL" },
    });
    if (contract) {
      await prisma.rentalContract.create({
        data: { ...contract, assetId: asset.id, currency: "GEL" },
      });
      contractCount += 1;
    }
  }

  // Manual income entries (rent + STR income are derived automatically).
  const incomes = [
    { source: "salary", description: "Monthly salary", date: utc(2026, 5, 30), amount: 5000 },
    { source: "salary", description: "Monthly salary", date: utc(2026, 6, 30), amount: 5000 },
    { source: "salary", description: "Monthly salary", date: utc(2026, 7, 15), amount: 5000 },
    { source: "dividend", description: "Annual dividend — KolkhetiCo", date: utc(2026, 6, 15), amount: 3200 },
    { source: "business", description: "Consulting invoice", date: utc(2026, 7, 8), amount: 1800 },
  ];
  for (const income of incomes) {
    await prisma.incomeRecord.create({
      data: { ...income, operatorId: operator.id, currency: "GEL" },
    });
  }

  console.log(
    `Seeded: 1 operator, ${units.length} units, ${bookingCount} bookings, ` +
      `${leases.length} leases, ${benchmarkCount} benchmark rows, ` +
      `${assets.length} assets, ${contractCount} contracts, ` +
      `${rentBenchmarkCount} rent benchmarks, ${incomes.length} income records.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
