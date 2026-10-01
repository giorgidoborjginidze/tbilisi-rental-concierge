import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale } from "@/lib/i18n/strings";
import { DAY_LET_WITHOUT_UNIT } from "@/lib/property/places";

/**
 * Flats let by the day that exist only under Assets: the calendar shows
 * them, but a stay or a nightly price needs the unit they get with one tap
 * on /units ("add to rentals"). Said where they would be missed — the
 * booking form and the price suggestions — instead of leaving them out.
 */
export default async function LooseFlatsNote({ locale, operatorId }: { locale: Locale; operatorId: string }) {
  const flats = await prisma.asset.findMany({
    where: { operatorId, ...DAY_LET_WITHOUT_UNIT },
    select: { name: true, nameKa: true },
    orderBy: { name: "asc" },
    take: 5,
  });
  if (flats.length === 0) return null;
  const names = flats.map((flat) => (locale === "ka" && flat.nameKa ? flat.nameKa : flat.name)).join(", ");
  return (
    <p className="alert-card alert-card--info" style={{ display: "block", fontSize: 13 }}>
      {t(locale, "loose_flats_note").replace("{names}", names)}{" "}
      <Link href="/units" className="link">
        {t(locale, "units_title")}
      </Link>
    </p>
  );
}
