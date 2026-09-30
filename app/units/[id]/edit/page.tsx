import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { parseAmenities, parseChannelLinks } from "@/lib/types";
import UnitForm from "../../unit-form";
import { unitFormProps } from "../../form-helpers";
import FeedStatus from "../../feed-status";
import { feedUrlsOf } from "@/lib/ical/run-sync";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await requireOperator();

  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, operatorId: operator.id },
    include: { feeds: true },
  });
  if (!unit) notFound();

  const locale = await getLocale();
  const links = parseChannelLinks(unit.channelLinks);

  return (
    <main>
      <h1>{t(locale, "unit_edit_title")}</h1>
      <UnitForm
        {...unitFormProps(locale)}
        feedStatus={
          links.icalUrls.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>{t(locale, "feed_title")}</h3>
              <FeedStatus locale={locale} urls={feedUrlsOf(unit.channelLinks)} feeds={unit.feeds} />
            </>
          ) : undefined
        }
        unit={{
          id: unit.id,
          name: unit.name,
          nameKa: unit.nameKa ?? "",
          city: unit.city,
          district: unit.district,
          address: unit.address,
          type: unit.type,
          capacity: unit.capacity,
          bedrooms: unit.bedrooms,
          baseNightlyRate: unit.baseNightlyRate,
          currency: unit.currency,
          amenities: parseAmenities(unit.amenities).join(", "),
          airbnbUrl: links.airbnbUrl ?? "",
          bookingUrl: links.bookingUrl ?? "",
          icalUrls: links.icalUrls.join("\n"),
        }}
      />
    </main>
  );
}
