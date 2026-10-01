import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator, readOnlyOperator } from "@/lib/auth/session";
import FilesSection from "@/app/files/files-section";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { parseAmenities, parseChannelLinks } from "@/lib/types";
import UnitForm from "../../unit-form";
import { linkableAssets, unitFormProps } from "../../form-helpers";
import FeedStatus from "../../feed-status";
import { feedUrlsOf } from "@/lib/ical/run-sync";
import { cityKey, districtLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";
import { headers } from "next/headers";
import { shownOrigin } from "@/lib/site";
import CalendarExport from "../../calendar-export";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("unit_edit_title");

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await requireOperator();

  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, operatorId: operator.id },
    include: {
      feeds: true,
      asset: { select: { id: true, name: true, nameKa: true } },
      calendarExport: { select: { token: true } },
    },
  });
  if (!unit) notFound();

  const locale = await getLocale();
  const links = parseChannelLinks(unit.channelLinks);

  return (
    <main>
      <h1>{t(locale, "unit_edit_title")}</h1>
      <UnitForm
        {...unitFormProps(locale)}
        assets={unit.asset ? [] : await linkableAssets(operator.id, locale)}
        linkedAsset={
          unit.asset
            ? {
                id: unit.asset.id,
                label: locale === "ka" && unit.asset.nameKa ? unit.asset.nameKa : unit.asset.name,
              }
            : null
        }
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
          city: cityKey(unit.city) ?? unit.city,
          district: districtLabel(locale, unit.district),
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

      {/* Activo's nights, for the channels to block (lib/ical/export.ts). */}
      <section id="calendar-export" style={{ marginTop: 28 }}>
        <h2>{t(locale, "cal_export_title")}</h2>
        <p className="field-hint">{t(locale, "cal_export_sub")}</p>
        <CalendarExport
          unitId={unit.id}
          base={
            unit.calendarExport
              ? `${shownOrigin(await headers())}/api/ical/${unit.calendarExport.token}.ics`
              : null
          }
          labels={Object.fromEntries(
            (
              [
                "cal_export_make", "cal_export_for_airbnb", "cal_export_for_booking", "cal_export_how",
                "cal_export_new", "cal_export_new_q", "cancel",
              ] as const
            ).map((key) => [key, t(locale, key)]),
          )}
        />
      </section>

      {/* A unit linked to an asset shares the asset's files: one place for them. */}
      <div style={{ marginTop: 28 }}>
        <FilesSection
          place={unit.asset ? { assetId: unit.asset.id } : { unitId: unit.id }}
          locale={locale}
          operatorId={operator.id}
          readOnly={readOnlyOperator(operator)}
        />
      </div>
    </main>
  );
}
