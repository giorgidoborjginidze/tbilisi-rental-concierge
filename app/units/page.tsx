import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { feedUrlsOf } from "@/lib/ical/run-sync";
import RentalsSubnav from "../rentals-subnav";
import FeedStatus from "./feed-status";
import SyncButton from "./sync-button";
import { cityLabel, districtLabel } from "@/lib/places";
import { formatMoney } from "@/lib/format";
import { titled } from "@/lib/i18n/metadata";
import { DAY_LET_WITHOUT_UNIT } from "@/lib/property/places";
import { addAssetToRentals } from "@/lib/assets/actions";
import { LIVE_STAY } from "@/lib/bookings/live";
import { linkUnitToAsset } from "@/lib/units/actions";
import { suggestAssetFor } from "@/lib/property/link";
import { Notice } from "../alert-icon";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("units_title");

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>;
}) {
  const operator = await requireOperator();
  const { linked } = await searchParams;

  const locale = await getLocale();
  const units = await prisma.unit.findMany({
    where: { operatorId: operator.id },
    include: {
      // Live stays only: a cancelled stay or a channel copy is not a booking.
      _count: { select: { bookings: { where: LIVE_STAY }, leases: true } },
      feeds: true,
      // The same flat under Assets: its value, and where long contracts live.
      asset: { select: { id: true, name: true, nameKa: true } },
    },
    orderBy: [{ city: "asc" }, { district: "asc" }, { name: "asc" }],
  });
  // Flats let by the day that were added under Assets before the two were
  // linked: on the calendar already, one click from a unit of their own.
  const looseFlats = await prisma.asset.findMany({
    where: { operatorId: operator.id, ...DAY_LET_WITHOUT_UNIT },
    select: { id: true, name: true, nameKa: true },
    orderBy: { name: "asc" },
  });
  // Units with no asset beside real-estate assets with no unit: possibly the
  // same flat entered twice. Offered as pairs to link, best guess first.
  const linkable = await prisma.asset.findMany({
    where: { operatorId: operator.id, category: "real_estate", unitId: null },
    select: { id: true, name: true, nameKa: true, city: true, district: true },
    orderBy: { name: "asc" },
  });
  const assetLabel = (asset: { name: string; nameKa: string | null }) =>
    locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;
  const unlinkedUnits =
    linkable.length > 0
      ? await prisma.unit.findMany({
          where: { operatorId: operator.id, asset: null },
          select: { id: true, name: true, nameKa: true, city: true, district: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <main>
      <RentalsSubnav active="units" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "units_title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SyncButton
            labels={{
              sync_now: t(locale, "sync_now"),
              sync_running: t(locale, "sync_running"),
              sync_done: t(locale, "sync_done"),
              sync_done_errors: t(locale, "sync_done_errors"),
              sync_none: t(locale, "sync_none"),
              sync_demo: t(locale, "sync_demo"),
            }}
          />
          <Link href="/bookings/new" className="btn-secondary">
            {t(locale, "bookings_add")}
          </Link>
          <Link href="/units/new" className="btn-primary">
            {t(locale, "units_add")}
          </Link>
        </div>
      </div>

      {looseFlats.length > 0 && (
        <div className="alert-card alert-card--info" style={{ display: "block", marginBottom: 16 }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>{t(locale, "units_loose_flats")}</div>
          <ul className="loose-flats">
            {looseFlats.map((asset) => (
              <li key={asset.id}>
                <Link href={`/assets/${asset.id}/edit`} className="link">
                  {locale === "ka" && asset.nameKa ? asset.nameKa : asset.name}
                </Link>
                <form action={addAssetToRentals}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <button type="submit" className="btn-chip">{t(locale, "units_add_from_asset")}</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {linked === "1" && (
        <Notice severity="good" role="status" style={{ marginBottom: 16 }}>
          {t(locale, "units_link_done")}
        </Notice>
      )}

      {unlinkedUnits.length > 0 && (
        <div className="alert-card alert-card--info" style={{ display: "block", marginBottom: 16 }}>
          <strong>{t(locale, "units_link_title")}</strong>
          <div className="alert-card__detail">{t(locale, "units_link_text")}</div>
          <ul className="loose-flats">
            {unlinkedUnits.map((unit) => (
              <li key={unit.id}>
                <span>{locale === "ka" && unit.nameKa ? unit.nameKa : unit.name}</span>
                <form action={linkUnitToAsset} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="unitId" value={unit.id} />
                  <label className="sr-only" htmlFor={`link-${unit.id}`}>
                    {t(locale, "unit_asset_link")}
                  </label>
                  <select
                    id={`link-${unit.id}`}
                    name="assetId"
                    defaultValue={suggestAssetFor(unit, linkable) ?? linkable[0].id}
                  >
                    {linkable.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {assetLabel(asset)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-chip">{t(locale, "units_link_btn")}</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {units.length === 0 ? (
        looseFlats.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "units_empty")}</p>
        )
      ) : (
        <div className="card card--stack">
          <table>
            <thead>
              <tr>
                <th>{t(locale, "unit_name")}</th>
                <th>{t(locale, "unit_district")}</th>
                <th>{t(locale, "unit_type")}</th>
                <th className="num">{t(locale, "base_rate_short")}</th>
                <th className="num">{t(locale, "bookings")}</th>
                <th className="ical-cell">iCal</th>
                <th>{t(locale, "unit_asset_link")}</th>
                <th><span className="sr-only">{t(locale, "col_actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const urls = feedUrlsOf(unit.channelLinks);
                const displayName =
                  locale === "ka" && unit.nameKa ? unit.nameKa : unit.name;
                return (
                  <tr key={unit.id}>
                    <td>
                      <div>{displayName}</div>
                      <div className="cell-sub">
                        {[cityLabel(locale, unit.city), unit.address].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td data-label={t(locale, "unit_district")}>{districtLabel(locale, unit.district)}</td>
                    <td data-label={t(locale, "unit_type")}>{t(locale, `type_${unit.type}` as StringKey)}</td>
                    <td className="num" data-label={t(locale, "base_rate_short")}>
                      {formatMoney(unit.baseNightlyRate, unit.currency)}
                    </td>
                    <td className="num" data-label={t(locale, "bookings")}>{unit._count.bookings}</td>
                    <td data-label="iCal" className="ical-cell">
                      {urls.length > 0 ? (
                        <FeedStatus locale={locale} urls={urls} feeds={unit.feeds} compact />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label={t(locale, "unit_asset_link")}>
                      {unit.asset ? (
                        <>
                          <Link href={`/assets/${unit.asset.id}/edit`} className="link">
                            {locale === "ka" && unit.asset.nameKa ? unit.asset.nameKa : unit.asset.name}
                          </Link>
                          <div className="cell-sub">
                            <Link href={`/assets/${unit.asset.id}/edit?add=contract#contracts`} className="link">
                              {t(locale, "unit_add_lease")}
                            </Link>
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>{t(locale, "unit_no_asset")}</span>
                      )}
                    </td>
                    <td className="num">
                      <Link href={`/units/${unit.id}/edit`} className="link">
                        {t(locale, "edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
